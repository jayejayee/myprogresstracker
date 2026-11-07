"use client";

import { useState, type ReactNode } from "react";
import { Dumbbell, LayoutGrid, ListTodo } from "lucide-react";

type DashboardFilter = "all" | "tasks" | "workouts";

const filters: {
  id: DashboardFilter;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "tasks", label: "Tasks & Projects", icon: ListTodo },
  { id: "workouts", label: "Workouts", icon: Dumbbell },
];

export function HomeDashboardFilters({
  tasksContent,
  workoutsContent,
}: {
  tasksContent: ReactNode;
  workoutsContent: ReactNode;
}) {
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>("all");

  return (
    <div>
      <div
        role="group"
        aria-label="Filter dashboard cards"
        className="flex flex-wrap gap-2"
      >
        {filters.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeFilter === id}
            onClick={() => setActiveFilter(id)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
              activeFilter === id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
        {(activeFilter === "all" || activeFilter === "tasks") &&
          tasksContent}
        {(activeFilter === "all" || activeFilter === "workouts") &&
          workoutsContent}
      </div>
    </div>
  );
}
