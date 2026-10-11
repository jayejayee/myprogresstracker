import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { TodoList } from "@/components/todo-list";

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const name =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : user.email?.split("@")[0] ?? "there";

  const { data, error } = await supabase
    .from("todolist")
    .select("id, todo, todoby, completedstatus, created_at")
    .eq("userprofile", user.id)
    .order("created_at", { ascending: false });

  const todos = (data ?? []).map((todo) => ({
    id: todo.id,
    title: todo.todo,
    dueDate: todo.todoby,
    completed: todo.completedstatus,
  }));

  return (
    <div>
      <h1 className="py-4 text-3xl font-semibold">Welcome back, {name}</h1>
      <TodoList
        initialTodos={todos}
        loadError={error ? "Could not load your tasks. Check the todolist columns and Supabase row-level security." : null}
      />
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<p className="py-4 text-sm text-muted-foreground">Loading your tasks...</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
