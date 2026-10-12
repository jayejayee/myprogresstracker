drop policy if exists "Users can manage their own todos" on public.todolist;

create policy "Users can manage their own todos"
  on public.todolist
  for all
  to authenticated
  using ((select auth.uid())::text = userprofile)
  with check (
    (select auth.uid())::text = userprofile
    and (
      projectid is null
      or exists (
        select 1
        from public.projects as owned_project
        where owned_project.id = todolist.projectid
          and owned_project.userprofile = (select auth.uid())::text
      )
    )
  );

drop policy if exists "Users can manage their own reminders"
  on public.reminders;

create policy "Users can manage their own reminders"
  on public.reminders
  for all
  to authenticated
  using ((select auth.uid())::text = userprofile)
  with check (
    (select auth.uid())::text = userprofile
    and (
      (entity_type = 'task' and exists (
        select 1
        from public.todolist as owned_task
        where owned_task.id = entity_id
          and owned_task.userprofile = (select auth.uid())::text
      ))
      or (entity_type = 'project' and exists (
        select 1
        from public.projects as owned_project
        where owned_project.id = entity_id
          and owned_project.userprofile = (select auth.uid())::text
      ))
    )
  );