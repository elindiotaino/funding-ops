create extension if not exists pgcrypto;

create table if not exists public.official_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  base_url text not null,
  jurisdiction text not null,
  interface_type text not null,
  active boolean not null default true,
  default_cadence text not null default 'daily',
  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by text not null,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  sources_attempted integer not null default 0,
  sources_succeeded integer not null default 0,
  sources_failed integer not null default 0,
  items_upserted integer not null default 0,
  notes text
);

create table if not exists public.ingestion_run_sources (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  source_id uuid not null references public.official_sources(id) on delete cascade,
  status text not null check (status in ('running', 'success', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  items_seen integer not null default 0,
  items_inserted integer not null default 0,
  items_updated integer not null default 0,
  items_unchanged integer not null default 0,
  error_message text
);

create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.official_sources(id) on delete restrict,
  source_item_id text not null,
  canonical_key text not null unique,
  title text not null,
  category text not null,
  jurisdiction text not null,
  audience text,
  summary text,
  eligibility text,
  amount text,
  deadline text,
  geography text,
  status text not null default 'active',
  source_url text not null,
  published_at timestamptz,
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  content_hash text not null,
  naics_codes jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, source_item_id)
);

create table if not exists public.feed_item_snapshots (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  snapshot_date date not null,
  rank_inputs jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  unique (ingestion_run_id, feed_item_id)
);

create table if not exists public.feed_item_details (
  id uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null unique references public.feed_items(id) on delete cascade,
  detail_status text not null default 'fresh',
  detail_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  source_detail_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_official_sources_source_key
  on public.official_sources(source_key);

create index if not exists idx_ingestion_run_sources_run_id
  on public.ingestion_run_sources(ingestion_run_id);

create index if not exists idx_feed_items_category
  on public.feed_items(category);

create index if not exists idx_feed_items_jurisdiction
  on public.feed_items(jurisdiction);

create index if not exists idx_feed_item_snapshots_snapshot_date
  on public.feed_item_snapshots(snapshot_date desc);

create index if not exists idx_feed_item_details_fetched_at
  on public.feed_item_details(fetched_at desc);

create table if not exists public.funding_ops_user_profiles (
  profile_id uuid primary key,
  company_name text not null,
  company_summary text not null,
  geography text not null,
  naics_codes jsonb not null default '[]'::jsonb,
  sectors jsonb not null default '[]'::jsonb,
  assistance_types jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  notification_mode text not null default 'digest'
    check (notification_mode in ('digest', 'instant', 'muted')),
  notification_email text not null default '',
  daily_summary_enabled boolean not null default false,
  email_categories jsonb not null default '[]'::jsonb,
  email_jurisdictions jsonb not null default '[]'::jsonb,
  email_tags jsonb not null default '[]'::jsonb,
  last_daily_summary_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_funding_ops_user_profiles_updated_at
  on public.funding_ops_user_profiles(updated_at desc);
