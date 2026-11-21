// Public site worker. Static asset requests never hit this script (except
// asset misses); only /data/* and /event-images/* are routed here first.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/data/events.json") {
      // KV is edge-cached internally (~60s propagation after a manager save).
      const stored = await env.EVENTS.get("events");
      let body = '{"events":[]}';
      if (stored !== null) {
        // Strip authorship fields (emails) before exposing publicly.
        const { events } = JSON.parse(stored);
        body = JSON.stringify({
          events: events.map(({ createdBy, updatedBy, createdAt, updatedAt, pk, ...publicEvent }) => publicEvent),
        });
      }
      return new Response(body, {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
      });
    }

    if (url.pathname.startsWith("/event-images/")) {
      const cache = caches.default;
      let response = await cache.match(request);
      if (!response) {
        const object = await env.IMAGES.get(url.pathname.slice(1));
        if (object === null) return new Response("Not found", { status: 404 });
        // Image keys are unique per upload, so they are immutable and can be
        // cached for a year at the edge.
        response = new Response(object.body, {
          headers: {
            "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
        ctx.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    }

    return env.ASSETS.fetch(request);
  },
};
