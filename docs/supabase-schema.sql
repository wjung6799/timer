-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Creates per-user state and day-history tables, with row-level security so
-- each user only ever sees their own rows.

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.day_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  categories jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists day_history_user_date_idx
  on public.day_history (user_id, date desc);

alter table public.app_state enable row level security;
alter table public.day_history enable row level security;

drop policy if exists "app_state owner" on public.app_state;
create policy "app_state owner" on public.app_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "day_history owner" on public.day_history;
create policy "day_history owner" on public.day_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
