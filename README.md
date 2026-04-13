# Funding Ops

`funding-ops` is a standalone extraction of the `Funding Ops` workspace from
`client-acquisition-hub`. It is intended to become one tool in a broader tool
dashboard hosted at `hub.joche.dev`.

The intended Windows repo location is `D:\Projects\funding-ops` so Docker
runtime data and project storage stay off the system drive.

## What this repo owns

- funding program tracking
- funding checklist and task tracking
- a standalone app deployment at `funding-ops.joche.dev`
- future white-label or client-specific domains that point at the same Vercel project

## What this repo does not own

- the main cross-tool dashboard shell for `hub.joche.dev`
- CRM, prospecting, or client-delivery workflows from `client-acquisition-hub`

## Current scope

The current app now includes:

- official-source feed records for Puerto Rico and U.S. federal grants, aid, jobs, incentives, and recovery channels
- profile-based relevance ranking against company sectors, assistance types, geography, and keywords
- filters for keyword, category, jurisdiction, and tags
- notification generation for relevant feed items
- manual refresh plus a daily cron entry for feed refresh
- local SQLite persistence for legacy/local workflows
- shared Supabase-backed auth and tool authorization via `hub.joche.dev`

Issue `#6` introduces the next architecture step: a Dockerized ingestion service
that writes the daily feed into Supabase while the Next.js app becomes the
authenticated UI layer.

## Hub model

The intended model is:

1. `hub.joche.dev` acts as the dashboard homepage for all tools.
2. Each tool has its own GitHub repo.
3. Each tool has its own Vercel project and a primary `*.joche.dev` subdomain.
4. Additional domains such as `funding.stimulo.ai` can be attached to the same Vercel project so they deploy from the same source repo.

That gives you one codebase per tool and many branded entry points when needed.

## Multi-domain recommendation

Use one Vercel project for `funding-ops` when all domains should receive the same code.

- Primary domain: `funding-ops.joche.dev`
- Hub deep link target: `hub.joche.dev` -> `funding-ops.joche.dev`
- Additional domains: `funding.stimulo.ai`, `ops.clientdomain.com`, and similar aliases

Only split into multiple Vercel projects if one of these becomes true:

- a client needs custom code not shared by everyone
- a client needs separate environment variables or integrations
- a client needs isolated data storage

## Local setup

1. Copy `.env.example` to `.env.local`
2. Install dependencies with `npm.cmd install`
3. Start the app with `npm.cmd run dev`

The database is stored at `data/funding-ops.db`.

## Docker ingestion architecture

New files added for issue `#6`:

- `docker-compose.yml`
- `docker/ingest/`
- `docs/docker-supabase-architecture.md`
- `docs/shared-account-model.md`
- `docs/supabase-feed-schema.sql`
- `docs/supabase-migration-workflow.md`
- `docs/docker-local-operations.md`
- `supabase/migrations/`

The Docker service is designed to:

- run daily source automations
- normalize source data
- write canonical feed data into Supabase
- support future on-demand item-detail refresh

Current live-ingestion status:

- `grants-gov`: live adapter implemented with the public `search2` endpoint
- `simpler-grants`: adapter implemented when `SIMPLER_GRANTS_API_KEY` is configured
- `sam-assistance`: adapter implemented when `SAM_API_KEY` is configured
- `usaspending`: live award-intelligence adapter implemented with the public advanced award search API
- `openfema`: live adapter implemented with the public DisasterDeclarationsSummaries v2 dataset
- `usajobs`: adapter implemented when `USAJOBS_API_KEY` and `USAJOBS_API_EMAIL` are configured
- remaining sources are explicitly skipped until their adapters are implemented

Use `FUNDING_OPS_STORAGE_ROOT` to keep persistent Docker data on `D:`:

```powershell
$env:FUNDING_OPS_STORAGE_ROOT="D:/Projects/funding-ops/runtime/data"
docker compose up --build funding-ops-ingest
```

Read the full design in `docs/docker-supabase-architecture.md`.
Use `docs/docker-local-operations.md` for the day-to-day local Docker workflow.
Use `docs/shared-account-model.md` for the canonical identity, access, and provider-linking model that unblocks per-user Funding Ops settings.

## Supabase migration workflow

Issue `#7` adds a repo-native Supabase CLI workflow for the feed schema.

Key commands:

```powershell
npm run supabase:migration:new -- funding_ops_change_name
npm run supabase:db:push
npm run supabase:verify-feed-schema
```

The current remote apply target is the `joche.dev` Supabase project. See
`docs/supabase-migration-workflow.md` for the link/apply/verify steps and the
remote apply workflow.

## Local Docker operations

From `D:\Projects\funding-ops`:

```powershell
npm run ingest:start
npm run ingest:test
npm run ingest:stop
```

These scripts are the default local operational path for `funding-ops-ingest`.

You must also provide the shared Supabase env vars used by the hub, because this tool now enforces authenticated access and checks whether the current user has the `funding-ops` grant directly or through an organization.

For scheduled refreshes in Vercel, set:

- `CRON_SECRET` for the daily cron request to `/api/feed-refresh`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS` for outbound SMTP delivery
- `NOTIFICATION_FROM_EMAIL` for the sender address used in daily summary emails

For Google Workspace / Gmail app-password sending, use:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=<your Google mailbox>`
- `SMTP_PASS=<your Google app password>`

When daily summary email is enabled in the app and a notification email is set on the company profile, the cron refresh will send one summary email per day with the top relevant items.
