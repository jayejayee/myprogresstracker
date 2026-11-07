import { Suspense } from "react";
import { redirect } from "next/navigation";

async function LegacyTasksRedirect({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return redirect(view === "tasks" ? "/protected/tasks" : "/protected/projects");
}

export default function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="py-4 text-sm text-muted-foreground">
          Opening your tasks...
        </p>
      }
    >
      <LegacyTasksRedirect searchParams={searchParams} />
    </Suspense>
  );
}
