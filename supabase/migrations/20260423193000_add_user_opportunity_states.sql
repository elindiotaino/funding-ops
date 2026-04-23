create table if not exists public.user_opportunity_states (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  state text not null
    check (state in ('new', 'to-evaluate', 'interested', 'applied', 'waiting', 'not-a-fit', 'archived', 'won')),
  decision_reason text,
  decision_note text,
  applied_at timestamptz,
  follow_up_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, feed_item_id)
);

create index if not exists idx_user_opportunity_states_profile_id
  on public.user_opportunity_states(profile_id, updated_at desc);

create index if not exists idx_user_opportunity_states_feed_item_id
  on public.user_opportunity_states(feed_item_id, updated_at desc);
