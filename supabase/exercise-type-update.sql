grant update on table public.exercises to authenticated;

drop policy if exists "Users can update their own exercises"
  on public.exercises;

create policy "Users can update their own exercises"
  on public.exercises
  for update
  to authenticated
  using ((select auth.uid())::text = userprofile)
  with check ((select auth.uid())::text = userprofile);
