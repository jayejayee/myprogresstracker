"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  Circle,
  Clock3,
  Dumbbell,
  Timer,
} from "lucide-react";

type PlanTask = {
  id: number;
  title: string;
  dueDate: string | null;
  completed: boolean;
};

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TodaysPlanCard({ tasks }: { tasks: PlanTask[] }) {
  const [localDate, setLocalDate] = useState<string | null>(null);

  useEffect(() => {
    const updateDate = () => setLocalDate(getLocalDateKey(new Date()));
    const initialTimeout = window.setTimeout(updateDate, 0);
    const interval = window.setInterval(updateDate, 60_000);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);

  const todayTasks = localDate
    ? tasks
        .filter((task) => task.dueDate === localDate && !task.completed)
        .sort((first, second) => first.title.localeCompare(second.title))
    : [];
  const overdueTasks = localDate
    ? tasks
        .filter(
          (task) =>
            task.dueDate !== null &&
            task.dueDate < localDate &&
            !task.completed,
        )
        .sort((first, second) => {
          const dateOrder = (first.dueDate ?? "").localeCompare(
            second.dueDate ?? "",
          );
          return dateOrder || first.title.localeCompare(second.title);
        })
    : [];
  const visibleTasks = [...overdueTasks, ...todayTasks].slice(0, 5);
  const dateLabel = localDate
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date(`${localDate}T12:00:00`))
    : null;

  return (
    <section
      aria-label="Today's plan"
      aria-busy={!localDate}
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-violet-500/[0.06] p-5 text-card-foreground shadow-sm sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-violet-500/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            <CalendarCheck2 aria-hidden="true" className="size-4" />
            TODAY&apos;S PLAN
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {dateLabel ?? "Your day at a glance"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {localDate
              ? `${todayTasks.length} due today · ${overdueTasks.length} overdue`
              : "Checking your tasks for today..."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/protected/focus"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Timer aria-hidden="true" className="size-4" />
            Start focus
          </Link>
          <Link
            href="/protected/workouts/log"
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background/80 px-3 text-sm font-semibold transition hover:bg-accent"
          >
            <Dumbbell aria-hidden="true" className="size-4" />
            Workout
          </Link>
        </div>
      </div>

      <div className="relative mt-5 border-t pt-4">
        {!localDate ? (
          <p className="py-2 text-sm text-muted-foreground">
            Your schedule will appear here.
          </p>
        ) : visibleTasks.length ? (
          <>
            <ul className="divide-y">
              {visibleTasks.map((task) => {
                const isOverdue = task.dueDate !== null && task.dueDate < localDate;
                return (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    {isOverdue ? (
                      <Clock3
                        aria-hidden="true"
                        className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
                      />
                    ) : (
                      <Circle
                        aria-hidden="true"
                        className="size-4 shrink-0 text-violet-500"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {task.title}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        isOverdue
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isOverdue ? "Overdue" : "Today"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {(todayTasks.length + overdueTasks.length > visibleTasks.length ||
              todayTasks.length > 0) && (
              <Link
                href="/protected/tasks"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                View tasks
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/[0.06] px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">
                No overdue tasks or tasks due today.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
