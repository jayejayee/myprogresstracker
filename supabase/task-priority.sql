alter table public.todolist
  add column if not exists priority text not null default 'medium';

alter table public.todolist
  drop constraint if exists todolist_priority_check;

alter table public.todolist
  add constraint todolist_priority_check
  check (priority in ('high', 'medium', 'low'));
