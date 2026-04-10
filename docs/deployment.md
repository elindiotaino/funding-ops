# Deployment Notes

## Intended topology

- `hub.joche.dev`: dashboard homepage that lists tools
- `funding-ops.joche.dev`: primary production domain for this repo
- future domains like `funding.stimulo.ai`: aliases attached to the same Vercel project
- Windows working copy and Docker storage should live at `D:\Projects\funding-ops`

## Vercel model

Recommended first setup:

1. Create a dedicated Vercel project for `funding-ops`.
2. Connect it to the `funding-ops` GitHub repo.
3. Add `funding-ops.joche.dev` as the primary custom domain.
4. Add additional custom domains to the same project when they should all deploy from the same branch and commit history.

This keeps deployment simple:

- one repo
- one Vercel project
- many domains

## When to stop sharing one deployment

Split a client onto a separate Vercel project only if you need:

- different code
- different secrets or integrations
- different persistence
- slower or staged rollout controls

## Hub integration contract

`hub.joche.dev` should store tool metadata similar to:

```json
{
  "slug": "funding-ops",
  "name": "Funding Ops",
  "description": "Track funding programs, deadlines, and submission tasks.",
  "href": "https://funding-ops.joche.dev",
  "repo": "https://github.com/elindiotaino/funding-ops"
}
```

The hub can render cards from that metadata and open each tool in its own app domain.

## Docker ingest deployment

Issue `#6` adds a separate ingestion service for scheduled feed automation.

Recommended split:

- Vercel hosts the Next.js app
- Docker hosts `funding-ops-ingest`
- Supabase stores the feed, run history, and item details

For Windows hosts, use:

- repo root: `D:\Projects\funding-ops`
- runtime storage: `D:\Projects\funding-ops\runtime\data`

Start the service with:

```powershell
$env:FUNDING_OPS_STORAGE_ROOT="D:/Projects/funding-ops/runtime/data"
docker compose up --build funding-ops-ingest
```

Scheduler options:

- Windows Task Scheduler calling `POST /jobs/daily-refresh`
- host cron on a Linux Docker machine
- an external trusted scheduler calling the same internal endpoint

The service contract and schema live in:

- `docs/docker-supabase-architecture.md`
- `docs/supabase-feed-schema.sql`
