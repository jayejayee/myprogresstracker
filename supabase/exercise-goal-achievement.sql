grant update on table public.exercise_goals to authenticated;

drop policy if exists "Users can update their own exercise goals"
  on public.exercise_goals;

create policy "Users can update their own exercise goals"
  on public.exercise_goals
  for update
  to authenticated
  using ((select auth.uid())::text = userprofile)
  with check ((select auth.uid())::text = userprofile);
