# Docker Operationalization Checklist

This document explains what we are trying to accomplish with the Docker-based `funding-ops` architecture and lists the remaining work required to make it fully operational for local and production use.

## Objective

Move `funding-ops` from a static, SQLite-seeded feed into a Docker-operated ingestion system that:

- runs from `D:\Projects\funding-ops`
- checks official funding/job/aid sources on a schedule
- writes durable feed data into Supabase
- serves `hub.joche.dev/funding-ops` from Supabase-backed data
- supports day history, source filtering, and item detail refresh

## Target operating model

### Local

- repo root lives at `D:\Projects\funding-ops`
- Docker Desktop runs `funding-ops-ingest`
- runtime bind mount persists under `D:\Projects\funding-ops\runtime\data`
- local web app and local Docker service both talk to the same Supabase project

### Production

- web app stays in the current Next.js deployment path
- Docker ingestion service runs on an always-on host
- scheduler triggers daily refresh jobs
- Supabase is the source of truth for feed storage and history

## What is already done

- issue `#6` architecture is documented in `docs/docker-supabase-architecture.md`
- first-pass Supabase schema exists in `docs/supabase-feed-schema.sql`
- Docker scaffold exists in `docker-compose.yml` and `docker/ingest/`
- repo has been moved to `D:\Projects\funding-ops`
- local Docker image builds successfully
- local container boots successfully
- local `GET /health` succeeds on port `8787`
- local `POST /jobs/daily-refresh` can complete successfully after the Supabase schema is applied

## What local validation proved

The Docker scaffold itself is viable:

- Docker build works
- container startup works
- local port exposure works
- runtime storage on `D:` works

The original schema blocker is resolved. The remaining work for full operational maturity is making the runtime workflow repeatable, then replacing placeholder adapters with real source ingestion.

## Remaining workstreams

### Schema and database readiness

- apply the feed schema to Supabase
- establish a repeatable migration/apply workflow
- add read/write policy expectations for app vs ingestion roles
- use the repo-native Supabase migration workflow in `supabase/migrations/`

### Ingestion service implementation

- replace placeholder adapter logic with real source adapters
- persist source runs, feed items, snapshots, and details into Supabase
- improve structured logging and operational visibility

### Web app migration

- move feed reads from local SQLite into Supabase-backed queries
- keep current auth behavior while changing the data source
- support day history and source/date filtering from Supabase

### Item detail refresh

- support item-level on-demand refresh through the ingestion service
- store detail payloads and freshness timestamps
- render details in an accessible modal in the web app

### Operations

- define required env vars for local and production use
- define scheduler setup for daily refresh
- add a repeatable local validation workflow
- document recovery steps for failed source runs
- keep `D:\Projects\funding-ops` as the canonical Windows runtime path

## Issue map

Existing issues:

- `#3` Replace static daily feed reseeding with real source ingestion
- `#4` Add day-based feed history and source/date filtering to `/funding-ops`
- `#5` Add feed item detail modal with on-demand source refresh
- `#6` URGENT: Design Docker ingestion API + Supabase feed architecture

New operational issues should cover the gaps not already explicit in those issues:

- Supabase schema + migration workflow
- web-app migration from SQLite feed reads to Supabase feed reads
- Docker runtime, scheduler, and validation workflow

## Definition of fully operational

`funding-ops` is fully operational when:

- Docker ingestion can run locally and in production
- Supabase schema is applied and stable
- daily refresh writes real source-backed feed data
- `/funding-ops` reads feed data from Supabase instead of local SQLite feed tables
- users can browse current and prior feed runs
- users can open item details with on-demand refresh support
- local startup from `D:\Projects\funding-ops` is documented and repeatable
