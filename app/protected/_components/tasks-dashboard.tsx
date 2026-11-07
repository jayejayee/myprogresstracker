import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { TodoList } from "@/components/todo-list";
import { createClient } from "@/lib/supabase/server";

export async function TasksDashboard({
  view,
}: {
  view: "projects" | "tasks";
}) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [todoResult, projectResult, reminderResult] = await Promise.all([
    supabase
      .from("todolist")
      .select("id, todo, todoby, completedstatus, projectid, priority, created_at")
      .eq("userprofile", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, due_date")
      .eq("userprofile", user.id)
      .order("due_date", { ascending: true }),
    supabase
      .from("reminders")
      .select("entity_type, entity_id, entity_title, next_at, repeat_rule, timezone")
      .eq("userprofile", user.id)
      .eq("enabled", true),
  ]);

  const todos = (todoResult.data ?? []).map((todo) => ({
    id: todo.id,
    title: todo.todo,
    dueDate: todo.todoby,
    completed: todo.completedstatus,
    projectId: todo.projectid,
    priority: todo.priority as "high" | "medium" | "low",
  }));
  const projects = (projectResult.data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    dueDate: project.due_date,
  }));
  const reminders = (reminderResult.data ?? []).map((reminder) => ({
    entityType: reminder.entity_type as "task" | "project",
    entityId: reminder.entity_id,
    title: reminder.entity_title,
    nextAt: reminder.next_at,
    repeatRule: reminder.repeat_rule as "once" | "daily" | "weekly" | "monthly",
    timezone: reminder.timezone,
  }));
  const loadError =
    todoResult.error || projectResult.error || reminderResult.error
      ? "Could not load your tasks, projects, or reminders. Check the Supabase tables and row-level security."
      : null;

  return (
    <Suspense
      fallback={
        <p className="py-4 text-sm text-muted-foreground">
          Loading your {view}...
        </p>
      }
    >
      <TodoList
        view={view}
        initialTodos={todos}
        initialProjects={projects}
        initialReminders={reminders}
        loadError={loadError}
      />
    </Suspense>
  );
}
