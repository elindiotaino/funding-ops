alter table if exists public.funding_ops_user_profiles
  add column if not exists naics_codes jsonb not null default '[]'::jsonb;
