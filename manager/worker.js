// Manager worker: Google OAuth + events API (KV) + image upload (R2).
// The SPA in dist/ is served as static assets.

const SESSION_COOKIE = "manager_session";
const STATE_COOKIE = "manager_oauth_state";
const SESSION_TTL_S = 30 * 24 * 3600; // 30 days

const DISCIPLINES = ["wag", "mag", "tum", "fv", "tra", "acro"];
const EVENT_TYPES = ["competition", "workshop", "other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- crypto / session helpers ----------

function b64urlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeString(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return atob(padded);
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeSessionToken(secret, email) {
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_TTL_S}.${b64urlEncode(new TextEncoder().encode(email))}`;
  return `${payload}.${await hmacSign(secret, payload)}`;
}

async function verifySessionToken(secret, token) {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const expected = await hmacSign(secret, payload);
  if (!constantTimeEqual(expected, token.slice(lastDot + 1))) return null;
  const [expStr, emailB64] = payload.split(".");
  if (Number(expStr) * 1000 < Date.now()) return null;
  try {
    return new TextDecoder().decode(
      Uint8Array.from(b64urlDecodeString(emailB64), (c) => c.charCodeAt(0))
    );
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

const cookieParams = "HttpOnly; Secure; SameSite=Lax; Path=/";

// ---------- auth flow ----------

async function handleLogin(env, url) {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/callback`,
    response_type: "code",
    scope: "openid email",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", `https://accounts.google.com/o/oauth2/v2/auth?${params}`],
      ["Set-Cookie", `${STATE_COOKIE}=${state}; Max-Age=600; ${cookieParams}`],
    ],
  });
}

async function handleCallback(request, env, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = getCookie(request, STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response("Invalid OAuth state. Try logging in again.", { status: 400 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return new Response("Google token exchange failed.", { status: 401 });

  const { id_token } = await tokenResponse.json();
  // The id_token came directly from Google's token endpoint over TLS, so its
  // signature does not need to be re-verified here (per Google's docs).
  const claims = JSON.parse(b64urlDecodeString(id_token.split(".")[1]));
  const email = claims.email;
  if (!claims.email_verified || !email || !(await isAuthorized(env, email))) {
    return new Response(`You do not have permission to access this application.\n\nLogged in as: ${email}`, {
      status: 403,
    });
  }

  const token = await makeSessionToken(env.SESSION_SECRET, email);
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", "/"],
      [`Set-Cookie`, `${STATE_COOKIE}=; Max-Age=0; ${cookieParams}`],
      ["Set-Cookie", `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_S}; ${cookieParams}`],
    ],
  });
}

async function getSessionEmail(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return verifySessionToken(env.SESSION_SECRET, token);
}

function isSuperuser(env, email) {
  return !!email && email.toLowerCase() === (env.SUPERUSER_EMAIL ?? "").toLowerCase();
}

// Additional allowed users are managed by the superuser in the UI and stored
// in KV ("allowedUsers"), so granting access needs no redeploy.
async function isAuthorized(env, email) {
  if (!email) return false;
  if (isSuperuser(env, email)) return true;
  const users = await env.EVENTS.get("allowedUsers", "json");
  return Array.isArray(users) && users.includes(email.toLowerCase());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- audit history ----------

const AUDITED_FIELDS = [
  "name",
  "country",
  "date",
  "eventType",
  "entriesOpen",
  "entriesClose",
  "minimumAge",
  "disciplines",
  "details",
  "imageUrl",
];

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function diffEvents(before, after) {
  const changes = {};
  for (const field of AUDITED_FIELDS) {
    const from = before ? before[field] ?? null : null;
    const to = after[field] ?? null;
    if (!sameValue(from, to)) changes[field] = { from, to };
  }
  return changes;
}

// shortcut: per-event audit arrays grow unbounded and KV writes are
// last-write-wins; fine at this scale, revisit if history gets huge
async function recordAudit(env, sk, email, action, changes) {
  const key = `audit:${sk}`;
  const entries = (await env.EVENTS.get(key, "json")) ?? [];
  entries.push({ at: Math.floor(Date.now() / 1000), by: email, action, changes });
  await env.EVENTS.put(key, JSON.stringify(entries));
}

// ---------- events API ----------

async function readEvents(env) {
  const stored = await env.EVENTS.get("events");
  return stored === null ? [] : JSON.parse(stored).events;
}

async function writeEvents(env, events) {
  await env.EVENTS.put("events", JSON.stringify({ events }));
}

// Validates and normalizes an event from the client. Returns [error, fields].
function normalizeEvent(body) {
  if (typeof body !== "object" || body === null) return ["Invalid request body."];
  const { name, country, date } = body;
  if (typeof name !== "string" || !name.trim()) return ["Event Name is required."];
  if (typeof country !== "string" || !country.trim()) return ["Country is required."];
  if (typeof date !== "string" || !DATE_RE.test(date)) return ["Date must be YYYY-MM-DD."];

  const event = { name: name.trim(), country: country.trim(), date };
  for (const key of ["entriesOpen", "entriesClose"]) {
    if (body[key] != null) {
      if (typeof body[key] !== "string" || !DATE_RE.test(body[key])) return [`${key} must be YYYY-MM-DD.`];
      event[key] = body[key];
    }
  }
  if (body.minimumAge != null) {
    const age = Number(body.minimumAge);
    if (!Number.isInteger(age) || age < 0 || age > 100) return ["minimumAge must be an integer 0-100."];
    event.minimumAge = age;
  }
  if (body.eventType != null) {
    if (!EVENT_TYPES.includes(body.eventType)) return ["Invalid eventType."];
    event.eventType = body.eventType;
  }
  if (body.disciplines != null) {
    if (!Array.isArray(body.disciplines) || body.disciplines.some((d) => !DISCIPLINES.includes(d))) {
      return ["Invalid disciplines."];
    }
    event.disciplines = body.disciplines;
  }
  if (body.details != null) {
    if (typeof body.details !== "string") return ["details must be a string."];
    event.details = body.details;
  }
  if (body.imageUrl != null) {
    if (typeof body.imageUrl !== "string" || !/^\/event-images\/[\w./-]+$/.test(body.imageUrl)) {
      return ["Invalid imageUrl."];
    }
    event.imageUrl = body.imageUrl;
  }
  return [null, event];
}

async function eventSk(name, date) {
  // Same scheme as the old Streamlit manager: epochSeconds(date) + 8 hex chars of sha256(name)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name));
  const nameHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
  const epochSeconds = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  return `${epochSeconds}#${nameHash}`;
}

async function handleApi(request, env, email, url, superuser) {
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/me") {
    return Response.json({ email, isSuperuser: superuser });
  }

  if (path === "/api/users" || path === "/api/users/delete") {
    if (!superuser) return Response.json({ error: "Only the superuser can manage users." }, { status: 403 });
    if (request.method === "GET" && path === "/api/users") {
      return Response.json({ users: (await env.EVENTS.get("allowedUsers", "json")) ?? [] });
    }
    const body = await request.json().catch(() => null);
    const requestedEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
    if (request.method === "POST" && path === "/api/users") {
      if (!requestedEmail || !EMAIL_RE.test(requestedEmail)) {
        return Response.json({ error: "A valid email address is required." }, { status: 400 });
      }
      const users = (await env.EVENTS.get("allowedUsers", "json")) ?? [];
      if (!users.includes(requestedEmail)) users.push(requestedEmail);
      await env.EVENTS.put("allowedUsers", JSON.stringify(users));
      return Response.json({ users });
    }
    if (request.method === "POST" && path === "/api/users/delete") {
      if (!requestedEmail) {
        return Response.json({ error: "email is required." }, { status: 400 });
      }
      const users = ((await env.EVENTS.get("allowedUsers", "json")) ?? []).filter((u) => u !== requestedEmail);
      await env.EVENTS.put("allowedUsers", JSON.stringify(users));
      return Response.json({ users });
    }
  }

  if (request.method === "GET" && path === "/api/events") {
    return Response.json({ events: await readEvents(env) });
  }

  // /api/image is multipart — reading its body as JSON here would consume the
  // stream and break the formData() call below.
  const body =
    path === "/api/image" ? null
    : request.method === "POST" || request.method === "PUT" ? await request.json().catch(() => null)
    : null;

  if (request.method === "POST" && path === "/api/events") {
    const [error, fields] = normalizeEvent(body);
    if (error) return Response.json({ error }, { status: 400 });
    // shortcut: KV read-modify-write is last-write-wins; fine for a single admin
    const events = await readEvents(env);
    const event = {
      ...fields,
      sk: await eventSk(fields.name, fields.date),
      createdBy: email,
      createdAt: Math.floor(Date.now() / 1000),
      updatedBy: email,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    events.push(event);
    await writeEvents(env, events);
    await recordAudit(env, event.sk, email, "created", diffEvents(null, event));
    return Response.json({ event });
  }

  if (request.method === "GET" && path.startsWith("/api/events/") && path.endsWith("/audit")) {
    const sk = decodeURIComponent(path.slice("/api/events/".length, -"/audit".length));
    return Response.json({ entries: (await env.EVENTS.get(`audit:${sk}`, "json")) ?? [] });
  }

  if (request.method === "PUT" && path.startsWith("/api/events/")) {
    const sk = decodeURIComponent(path.slice("/api/events/".length));
    const [error, fields] = normalizeEvent(body);
    if (error) return Response.json({ error }, { status: 400 });
    const events = await readEvents(env);
    const index = events.findIndex((e) => e.sk === sk);
    if (index === -1) return Response.json({ error: "Event not found." }, { status: 404 });
    const existing = events[index];
    const event = {
      ...existing,
      ...fields,
      sk: existing.sk, // sk encodes the original identity; edits don't rekey
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedBy: email,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    events[index] = event;
    await writeEvents(env, events);
    await recordAudit(env, sk, email, "updated", diffEvents(existing, event));
    return Response.json({ event });
  }

  if (request.method === "POST" && path === "/api/events/delete") {
    if (!Array.isArray(body?.sks) || body.sks.some((s) => typeof s !== "string")) {
      return Response.json({ error: "sks must be an array of strings." }, { status: 400 });
    }
    const events = await readEvents(env);
    const remaining = events.filter((e) => !body.sks.includes(e.sk));
    await writeEvents(env, remaining);
    for (const sk of body.sks) {
      // Audit entries intentionally outlive the event (key is orphaned)
      await recordAudit(env, sk, email, "deleted", {});
    }
    return Response.json({ deleted: events.length - remaining.length });
  }

  if (request.method === "POST" && path === "/api/image") {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Missing file." }, { status: 400 });
    const ext = { "image/png": "png", "image/jpeg": "jpg" }[file.type];
    if (!ext) return Response.json({ error: "Only PNG and JPEG images are supported." }, { status: 400 });
    const key = `event-images/${crypto.randomUUID()}.${ext}`;
    await env.IMAGES.put(key, file, { httpMetadata: { contentType: file.type } });
    return Response.json({ url: `/${key}` });
  }

  return Response.json({ error: "Not found." }, { status: 404 });
}

// ---------- worker entry ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login") return handleLogin(env, url);
    if (url.pathname === "/callback") return handleCallback(request, env, url);
    if (url.pathname === "/logout") {
      return new Response(null, {
        status: 302,
        headers: [
          ["Location", "/"],
          ["Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; ${cookieParams}`],
        ],
      });
    }

    if (url.pathname.startsWith("/api/")) {
      const email = await getSessionEmail(request, env);
      if (!email) return Response.json({ error: "Not authenticated." }, { status: 401 });
      return handleApi(request, env, email, url, isSuperuser(env, email));
    }

    // Serve uploaded images so previews in the manager UI work on this domain
    // (the SPA fallback would otherwise answer with index.html).
    if (url.pathname.startsWith("/event-images/")) {
      const object = await env.IMAGES.get(url.pathname.slice(1));
      if (object === null) return new Response("Not found", { status: 404 });
      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable", // keys are unique per upload
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
