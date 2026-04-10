# Docker Local Operations

This runbook is the practical implementation for issue `#9`.

## Prerequisites

- repo root at `D:\Projects\funding-ops`
- Docker Desktop running
- `.env.local` populated with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `INGEST_SHARED_SECRET`
- Supabase feed schema already applied

Optional:

- `.env.docker` for Docker-specific overrides that you do not want in `.env.local`

## Runtime storage

Persistent Docker runtime data should stay on `D:`:

```text
D:\Projects\funding-ops\runtime\data
```

The helper scripts create this directory automatically if it does not exist.

## Start the ingestion service

```powershell
npm run ingest:start
```

To force a rebuild first:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\funding-ops-ingest-start.ps1 -Build
```

## Validate the service

```powershell
npm run ingest:test
```

This:

1. verifies the Supabase feed schema
2. triggers `POST /jobs/daily-refresh`

Expected result:

- all feed tables verify
- refresh returns JSON with `status`

## Stop the service

```powershell
npm run ingest:stop
```

## Logs and health

```powershell
docker compose ps
docker compose logs --tail 120 funding-ops-ingest
```

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:8787/health" `
  -Headers @{ "x-ingest-secret" = "<your secret>" }
```

## Manual refresh

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post `
  -Uri "http://127.0.0.1:8787/jobs/daily-refresh" `
  -Headers @{ "x-ingest-secret" = "<your secret>" } `
  -ContentType "application/json" `
  -Body '{"triggeredBy":"manual"}'
```

## Windows Task Scheduler

Suggested scheduled task:

- Program/script: `powershell.exe`
- Arguments:
  `-ExecutionPolicy Bypass -File D:\Projects\funding-ops\scripts\funding-ops-ingest-test.ps1 -TriggeredBy scheduled-task`
- Start in: `D:\Projects\funding-ops`

If the task should ensure startup first, chain:

```powershell
PowerShell -ExecutionPolicy Bypass -File D:\Projects\funding-ops\scripts\funding-ops-ingest-start.ps1
PowerShell -ExecutionPolicy Bypass -File D:\Projects\funding-ops\scripts\funding-ops-ingest-test.ps1 -TriggeredBy scheduled-task
```

## Failure recovery

### Service will not start

- check `docker compose logs --tail 120 funding-ops-ingest`
- confirm Docker Desktop is running
- confirm `INGEST_SHARED_SECRET` is set
- confirm runtime storage exists on `D:`

### Refresh fails

- run `npm run supabase:verify-feed-schema`
- inspect container logs
- confirm the container is pointed at the correct Supabase project

## Current limit

The Docker runtime is operational, but ingestion still uses placeholder adapters until issue `#3`.
