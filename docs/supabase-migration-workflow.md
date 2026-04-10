# Supabase Migration Workflow

This document is the concrete workflow for issue `#7`.

## Goal

Apply the feed schema to the remote `joche.dev` Supabase project and make future schema updates repeatable from this repo.

## Canonical project

- Supabase project ref: `tjodyipyariakclilszj`
- expected project name: `joche.dev`

## Files

- canonical migration: [supabase/migrations/20260410034810_funding_ops_feed_schema.sql](/D:/Projects/funding-ops/supabase/migrations/20260410034810_funding_ops_feed_schema.sql)
- schema reference copy: [docs/supabase-feed-schema.sql](/D:/Projects/funding-ops/docs/supabase-feed-schema.sql)
- verification script: [scripts/verify-supabase-feed-schema.mjs](/D:/Projects/funding-ops/scripts/verify-supabase-feed-schema.mjs)

## One-time link

You need the remote Postgres password for the `joche.dev` Supabase project.

From `D:\Projects\funding-ops`:

```powershell
npx supabase link --project-ref tjodyipyariakclilszj --password "<remote-db-password>"
```

This repo can already see the Supabase project list from the local CLI session, but it cannot push migrations until the database is linked with the Postgres password.

## Apply migrations

After linking:

```powershell
npx supabase db push
```

If you prefer a direct URL instead of a linked project:

```powershell
npx supabase db push --db-url "<postgres-connection-string>"
```

## Verify schema

Load the Supabase env into your shell, then run:

```powershell
node scripts/verify-supabase-feed-schema.mjs
```

Expected result:

- all required feed tables return `"ok": true`

## Post-apply validation

Once the schema is live, validate the Docker ingestion service:

```powershell
$env:INGEST_SHARED_SECRET="<local-secret>"
docker compose up -d funding-ops-ingest
```

Then trigger a local refresh:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post `
  -Uri "http://127.0.0.1:8787/jobs/daily-refresh" `
  -Headers @{ "x-ingest-secret" = "<local-secret>" } `
  -ContentType "application/json" `
  -Body '{"triggeredBy":"local-validation"}'
```

## Current blocker

As of the latest validation, the Docker service itself is healthy, but remote apply is blocked because the repo does not yet have the `joche.dev` remote Postgres password needed for `supabase link` or `db push`.
