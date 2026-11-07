"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type WorkoutTimestamp = {
  createdAt: string;
  workoutId: number | null;
};

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TrainingRhythmCard({ logs }: { logs: WorkoutTimestamp[] }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const workoutSessionsByDay = new Map<string, Set<string>>();
  if (now) {
    for (const log of logs) {
      const workoutDate = new Date(log.createdAt);
      if (!Number.isFinite(workoutDate.getTime())) continue;

      const dateKey = getLocalDateKey(workoutDate);
      const sessions = workoutSessionsByDay.get(dateKey) ?? new Set<string>();
      sessions.add(
        log.workoutId == null
          ? `legacy-${dateKey}`
          : `workout-${log.workoutId}`,
      );
      workoutSessionsByDay.set(dateKey, sessions);
    }
  }

  const weekActivity = now
    ? Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        const dateKey = getLocalDateKey(date);
        return {
          dateKey,
          day: new Intl.DateTimeFormat(undefined, {
            weekday: "short",
          }).format(date),
          date: new Intl.DateTimeFormat(undefined, {
            day: "numeric",
          }).format(date),
          isToday: index === 6,
          workouts: workoutSessionsByDay.get(dateKey)?.size ?? 0,
        };
      })
    : [];
  const weeklyWorkoutCount = weekActivity.reduce(
    (total, day) => total + day.workouts,
    0,
  );
  const activeWorkoutDays = weekActivity.filter(
    (day) => day.workouts > 0,
  ).length;
  const peakDailyWorkouts = Math.max(
    1,
    ...weekActivity.map((day) => day.workouts),
  );

  return (
    <article
      aria-busy={!now}
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-sky-500/5 p-5 text-card-foreground shadow-sm sm:col-span-2 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-20 size-48 rounded-full bg-sky-400/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
            YOUR LAST 7 DAYS
          </p>
          <h2 className="mt-1 text-lg font-semibold">Training rhythm</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {now ? weeklyWorkoutCount : "—"}
          </span>{" "}
          {weeklyWorkoutCount === 1 ? "workout" : "workouts"} ·{" "}
          <span className="font-semibold text-foreground">
            {now ? activeWorkoutDays : "—"}
          </span>{" "}
          active {activeWorkoutDays === 1 ? "day" : "days"}
        </p>
      </div>
      <div className="relative mt-5 grid grid-cols-7 gap-2 sm:gap-3">
        {weekActivity.length
          ? weekActivity.map((day) => (
              <div
                key={day.dateKey}
                className={`flex min-w-0 flex-col items-center rounded-xl px-1 py-3 sm:px-2 ${
                  day.isToday
                    ? "bg-sky-500/10 ring-1 ring-sky-500/20"
                    : "bg-muted/35"
                }`}
                aria-label={`${day.day}, ${day.date}: ${day.workouts} ${
                  day.workouts === 1 ? "workout" : "workouts"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                  {day.day}
                </span>
                <span className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                  {day.date}
                </span>
                <div className="mt-3 flex h-12 items-end">
                  <div
                    className={`w-5 rounded-full transition-all sm:w-7 ${
                      day.workouts > 0
                        ? day.isToday
                          ? "bg-gradient-to-t from-blue-600 to-sky-400"
                          : "bg-gradient-to-t from-sky-600/80 to-cyan-400"
                        : "h-2 bg-muted-foreground/15"
                    }`}
                    style={
                      day.workouts > 0
                        ? {
                            height: `${Math.max(
                              14,
                              (day.workouts / peakDailyWorkouts) * 48,
                            )}px`,
                          }
                        : undefined
                    }
                  />
                </div>
                <span className="mt-2 text-[10px] font-bold tabular-nums text-foreground/80">
                  {day.workouts || "·"}
                </span>
              </div>
            ))
          : Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className="flex min-w-0 flex-col items-center rounded-xl bg-muted/35 px-1 py-3 sm:px-2"
              >
                <span className="text-[10px] font-semibold text-muted-foreground sm:text-xs">
                  &nbsp;
                </span>
                <span className="mt-1 text-xs text-muted-foreground">&nbsp;</span>
                <div className="mt-3 h-12" />
                <span className="mt-2 text-[10px]">&nbsp;</span>
              </div>
            ))}
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Each bar represents workouts logged that day.
        </p>
        <Link
          href="/protected/workouts/history"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:gap-1.5"
        >
          History <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </article>
  );
}
