create table if not exists public.funding_ops_user_profiles (
  profile_id uuid primary key,
  company_name text not null,
  company_summary text not null,
  geography text not null,
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
