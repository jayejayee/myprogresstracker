import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { FocusTimer } from "@/components/focus-timer";
import { createClient } from "@/lib/supabase/server";

const TASK_PAGE_SIZE = 1000;

async function loadOpenTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const tasks: { id: number; todo: string }[] = [];

  for (let offset = 0; ; offset += TASK_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("todolist")
      .select("id, todo")
      .eq("userprofile", userId)
      .eq("completedstatus", false)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + TASK_PAGE_SIZE - 1);

    if (error) return { data: null, error };

    const page = data ?? [];
    tasks.push(...page);
    if (page.length < TASK_PAGE_SIZE) break;
  }

  return { data: tasks, error: null };
}

async function FocusContent() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: tasks, error } = await loadOpenTasks(supabase, user.id);

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Focus timer</h1>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          Could not load your open tasks. You can still use the focus timer
          without selecting a task.
        </p>
      )}
      <FocusTimer
        userId={user.id}
        tasks={(tasks ?? []).map((task) => ({
          id: task.id,
          title: task.todo,
        }))}
      />
    </>
  );
}

export default function FocusPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense
        fallback={
          <p className="py-4 text-sm text-muted-foreground">
            Loading your focus timer...
          </p>
        }
      >
        <FocusContent />
      </Suspense>
    </main>
  );
}
