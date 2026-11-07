import { Suspense } from "react";

import { TasksDashboard } from "@/app/protected/_components/tasks-dashboard";

export default function ProjectsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense
        fallback={
          <p className="py-4 text-sm text-muted-foreground">
            Loading your projects...
          </p>
        }
      >
        <TasksDashboard view="projects" />
      </Suspense>
    </main>
  );
}
