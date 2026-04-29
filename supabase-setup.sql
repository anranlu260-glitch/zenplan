create extension if not exists pgcrypto;

create table if not exists public.planner_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_planner_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists planner_states_set_updated_at on public.planner_states;
create trigger planner_states_set_updated_at
before update on public.planner_states
for each row
execute function public.set_planner_states_updated_at();

alter table public.planner_states enable row level security;

drop policy if exists "Users can read their own planner state" on public.planner_states;
create policy "Users can read their own planner state"
on public.planner_states
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own planner state" on public.planner_states;
create policy "Users can insert their own planner state"
on public.planner_states
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own planner state" on public.planner_states;
create policy "Users can update their own planner state"
on public.planner_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.planner_states to authenticated;
