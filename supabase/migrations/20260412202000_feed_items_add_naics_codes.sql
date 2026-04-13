alter table if exists public.feed_items
  add column if not exists naics_codes jsonb not null default '[]'::jsonb;
