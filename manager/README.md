# Manager

Admin app for editing events. A Svelte 5 SPA (`src/`, built to `dist/`) served
by a Cloudflare Worker (`worker.js`) that also implements:

- Google OAuth 2.0 login (authorization code flow) with an email allowlist.
  Sessions are HMAC-signed cookies.
- A JSON API backed by the same KV namespace the public site reads from.
- Image uploads to R2.

## Develop

```
bun install
bun run build     # build SPA into dist/
npx wrangler dev  # serves worker + dist/ with local KV/R2
```

Secrets (set once per environment with `npx wrangler secret put`, kept out of
this public repo): `SUPERUSER_EMAIL` (the only bootstrap credential — further
allowed users are added in the manager UI and stored in KV),
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`.

Google Cloud Console OAuth client must allow the redirect URI
`https://manager.adultgymnastics.events/callback`.
