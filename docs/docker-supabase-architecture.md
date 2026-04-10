# Docker + Supabase Architecture

This document implements the design described in issue `#6` and makes `D:\Projects\funding-ops` the intended Windows storage location for the repo and Docker runtime data.

## Target layout

On Windows, keep the repo and runtime data on `D:`:

```text
D:\Projects\
  funding-ops\
    docker-compose.yml
    .env.local
    docker\
      ingest\
    docs\
    runtime\
      data\
```

This keeps source, container config, and persisted runtime artifacts on the larger drive instead of `C:\Users\joche`.

## Service split

### `funding-ops-web`

- Next.js UI for `hub.joche.dev/funding-ops`
- reads feed data from Supabase
- opens item detail modal
- optionally asks the ingestion service for on-demand detail refresh

### `funding-ops-ingest`

- Dockerized API/worker
- runs scheduled source sync jobs
- normalizes source data
- writes canonical feed data into Supabase
- stores run, source, snapshot, and detail-refresh metadata

### `Supabase`

- source of truth for shared feed data
- durable storage for run history and cached details
- accessible by the web app with publishable/authenticated access patterns
- accessible by ingestion with the service-role key

## Scheduling model

Recommended production flow:

1. Keep Vercel focused on web delivery.
2. Run `funding-ops-ingest` on an always-on Docker host.
3. Use host cron, Windows Task Scheduler, or a supervisor job to hit `POST /jobs/daily-refresh`.
4. Let the ingestion service write results to Supabase.

The Docker service can also expose a health endpoint and source-specific refresh endpoints for manual recovery.

## Data model

The SQL in [supabase-feed-schema.sql](/C:/Users/joche/projects/funding-ops/docs/supabase-feed-schema.sql) defines the first-pass schema:

- `official_sources`
- `ingestion_runs`
- `ingestion_run_sources`
- `feed_items`
- `feed_item_snapshots`
- `feed_item_details`

This separates:

- source metadata
- run-level status
- per-source run outcomes
- canonical current item state
- day/run history
- cached detail payloads

## Source adapter model

Adapters should return a normalized shape regardless of source transport.

Adapter priority:

1. API, RSS, XML, or CSV sources
2. stable HTML listing pages
3. document-backed notices and linked PDFs

Current first-wave source list:

- Grants.gov
- Simpler.Grants.gov
- SAM.gov Assistance Listings
- USAJOBS
- USAspending.gov
- OpenFEMA
- Empleos.pr.gov
- ADSEF Servicios en Linea
- Recuperacion CDBG-DR/MIT
- AFV / Puerto Rico Housing Finance Authority
- DDEC Program Pages

## Runtime flow

### Daily refresh

1. Scheduler calls `POST /jobs/daily-refresh`.
2. Service validates `x-ingest-secret`.
3. Service creates an `ingestion_runs` row.
4. Each source adapter fetches latest data.
5. Results are normalized and upserted into `feed_items`.
6. The service writes `feed_item_snapshots` for the active run.
7. The service updates `official_sources.last_success_at` or `last_error_at`.
8. The run is finalized as `success`, `partial`, or `failed`.

### Detail refresh

1. User opens an item in the web app.
2. Web app reads cached detail from Supabase.
3. If stale, the web app calls `POST /jobs/item/:id/detail-refresh`.
4. Ingestion fetches current detail from the source.
5. Service updates `feed_item_details`.
6. Modal renders detail payload plus freshness metadata.

## Security

- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the ingestion service and trusted server contexts.
- Require `INGEST_SHARED_SECRET` for job endpoints.
- Do not expose service-role credentials to the browser.

## Windows move plan

After edits are complete, move the repo to:

```powershell
D:\Projects\funding-ops
```

Then update local tooling and shortcuts to use:

- repo root: `D:\Projects\funding-ops`
- runtime volume root: `D:\Projects\funding-ops\runtime\data`

Because `docker-compose.yml` uses `FUNDING_OPS_STORAGE_ROOT`, the persisted container data can stay on `D:` without changing the compose file again.
