# Public frontend

Plain static HTML/JS/CSS in `public/` — no build step. Deployed as a Cloudflare
Worker with static assets via `npx wrangler deploy`.

- Static asset requests are served free/unmetered from Cloudflare's edge.
- `/data/events.json` is served from KV (see `worker.js`), which the manager
  worker rewrites when events change. Updates propagate globally within ~60s.
- `/event-images/*` are served from R2 and edge-cached for a year (keys are
  unique per upload, so immutable).

See `wrangler.jsonc` for bindings and `../docs/cloudflare-migration.md` for
setup steps.
