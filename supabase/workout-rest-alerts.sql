create table if not exists public.workout_rest_alerts (
  userprofile text primary key default auth.uid()::text,
  next_at timestamptz,
  claimed_at timestamptz,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.workout_rest_alerts
  add column if not exists enabled boolean;

update public.workout_rest_alerts
set enabled = next_at is not null
where enabled is null;

alter table public.workout_rest_alerts
  alter column enabled set default false,
  alter column enabled set not null,
  alter column next_at drop not null;

alter table public.workout_rest_alerts enable row level security;

drop policy if exists "Users can manage their own workout rest alerts"
  on public.workout_rest_alerts;
create policy "Users can manage their own workout rest alerts"
  on public.workout_rest_alerts
  for all
  to authenticated
  using ((select auth.uid())::text = userprofile)
  with check ((select auth.uid())::text = userprofile);

grant select, insert, update, delete
  on public.workout_rest_alerts to authenticated;
