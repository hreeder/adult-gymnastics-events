# Cloudflare migration

This project runs natively on Cloudflare within the $5/mo Workers Paid plan:

| Component | Cloudflare resource |
|---|---|
| Public site (`frontend/`) | Worker with static assets (asset requests are free/unmetered) |
| `/data/events.json` | KV namespace `events` key, read by the public worker |
| Event images | R2 bucket `adult-gymnastics-event-images`, served + edge-cached by the public worker |
| Manager (`manager/`) | Worker (SPA assets + Google OAuth + JSON API) |
| CI | GitHub Actions → `wrangler deploy` (needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` repo secrets) |

The legacy AWS stack (S3 website bucket, DynamoDB + stream → Lambda → S3
export, Streamlit manager) is replaced entirely. `infrastructure/` still holds
the Terraform for teardown reference only.

## One-time setup

1. **Zone**: add `adultgymnastics.events` to Cloudflare and update nameservers
   at the registrar. Custom Worker domains and the R2 image route require the
   zone on Cloudflare.

2. **Create resources** (logged in via `npx wrangler login`):
   ```
   npx wrangler kv namespace create EVENTS
   npx wrangler r2 bucket create adult-gymnastics-event-images
   ```
   Copy the returned KV namespace id into `KV_NAMESPACE_ID` placeholders in
   both `frontend/wrangler.jsonc` and `manager/wrangler.jsonc`.

3. **Manager config** (all secrets, so nothing sensitive lands in the repo):
   ```
   cd manager
   npx wrangler secret put SUPERUSER_EMAIL    # your Google email; the only
                                              # bootstrap credential — further
                                              # users are added in the UI
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET     # any long random string
   ```

4. **Google OAuth**: in Google Cloud Console, add redirect URI
   `https://manager.adultgymnastics.events/callback` to the existing OAuth
   client (the one the Streamlit app used — client id/secret are reused).

5. **Migrate data** (two options):
   - **Without AWS access** (used for the initial migration; pulls the public
     exports from the live site — the old export strips `sk`, so it is
     regenerated deterministically, and authorship emails become a
     `migrated` placeholder):
     ```
     python scripts/import-live-events.py > events.json
     npx wrangler kv key put events --path events.json --namespace-id <KV_NAMESPACE_ID>
     # then fetch each imageUrl from the live site and upload to R2
     # (key = path without the leading /), e.g.:
     curl -o img https://adultgymnastics.events/event-images/<key>
     npx wrangler r2 object put "adult-gymnastics-event-images/<key>" --file img --content-type <mime>
     ```
   - **With legacy AWS credentials** (complete data incl. authorship emails):
     ```
     python scripts/migrate-ddb-to-kv.py > events.json
     npx wrangler kv key put events --path events.json --namespace-id <KV_NAMESPACE_ID>
     aws s3 sync s3://adult-gymnastics-event-images/ s3://adult-gymnastics-event-images/ \
       --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
     ```
   Existing `imageUrl` values (`/event-images/...`) keep working because keys
   are copied as-is.

6. **Deploy**: push to `main` (CI deploys both workers), or run
   `npx wrangler deploy` in `frontend/` and `manager/`. Custom domains attach
   automatically on deploy once the zone is on Cloudflare.

## Cutover / teardown of AWS

Once Cloudflare is verified serving the domain:

- Remove the S3 website bucket, DynamoDB table (and its stream-triggered
  Lambda), the `adult-gymnastics-events-manager` IAM user, and the GitHub
  Actions deploy role/bootstrap stack — via `terraform destroy` on
  `infrastructure/main` and `infrastructure/bootstrap`, or manually.
- The GitHub Actions secrets for AWS can be removed; add the Cloudflare ones.
- Delete `infrastructure/` once teardown is done.

## Notes & known limits

- KV is eventually consistent: manager saves take up to ~60s to appear on the
  public site globally (same UX as the old 60s Lambda debounce).
- KV writes are last-write-wins — fine for a single admin; revisit if multiple
  editors work concurrently.
- The public JSON now includes `sk`/`eventType`/`minimumAge` fields (the old
  export stripped some of them); authorship fields (emails) are still stripped
  in `frontend/worker.js` before serving.
