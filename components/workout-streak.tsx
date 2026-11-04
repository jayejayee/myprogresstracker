"use client";

import { useSyncExternalStore } from "react";
import { Flame } from "lucide-react";

function getLocalDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function subscribeToLocalDate(onChange: () => void) {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const timeout = window.setTimeout(onChange, tomorrow.getTime() - now.getTime());
  return () => window.clearTimeout(timeout);
}

function toLocalDate(timestamp: string) {
  const date = new Date(timestamp);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function getStreakDays(timestamps: string[], today: string) {
  if (!today || timestamps.length === 0) return 0;

  const workoutDays = [...new Set(timestamps.map(toLocalDate))].sort().reverse();
  const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  const todayNumber = dayNumber(today);
  const latestWorkoutDay = dayNumber(workoutDays[0]);

  if (todayNumber - latestWorkoutDay > 1 || latestWorkoutDay > todayNumber) {
    return 0;
  }

  let streak = 0;
  let expectedDay = latestWorkoutDay;

  for (const workoutDay of workoutDays) {
    const currentDay = dayNumber(workoutDay);
    if (currentDay !== expectedDay) break;
    streak += 1;
    expectedDay -= 1;
  }

  return streak;
}

export function WorkoutStreak({ timestamps }: { timestamps: string[] }) {
  const today = useSyncExternalStore(
    subscribeToLocalDate,
    getLocalDate,
    () => "",
  );
  const streak = getStreakDays(timestamps, today);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-800 dark:bg-orange-950/50 dark:text-orange-200"
      aria-live="polite"
    >
      <Flame aria-hidden="true" className="size-4" />
      {today ? `${streak} day streak` : "…"}
    </span>
  );
}
