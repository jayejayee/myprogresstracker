"use client";

import { useSyncExternalStore } from "react";
import { Flame } from "lucide-react";

const STREAK_GRACE_PERIOD_MS = 55 * 60 * 60 * 1000;

function getLatestWorkoutTimestamp(timestamps: string[]) {
  return timestamps.reduce((latest, timestamp) => {
    const parsedTimestamp = new Date(timestamp).getTime();
    return Number.isFinite(parsedTimestamp)
      ? Math.max(latest, parsedTimestamp)
      : latest;
  }, 0);
}

function isStreakActive(timestamps: string[], now: number) {
  const latestWorkout = getLatestWorkoutTimestamp(timestamps);
  return (
    latestWorkout > 0 &&
    latestWorkout <= now &&
    now - latestWorkout <= STREAK_GRACE_PERIOD_MS
  );
}

function subscribeToStreakClock(onChange: () => void, timestamps: string[]) {
  const latestWorkout = getLatestWorkoutTimestamp(timestamps);
  const now = Date.now();
  const nextUpdate =
    latestWorkout > now
      ? latestWorkout
      : latestWorkout > 0
        ? latestWorkout + STREAK_GRACE_PERIOD_MS
        : now;
  const timeout =
    nextUpdate > now
      ? window.setTimeout(onChange, nextUpdate - now)
      : undefined;

  return () => {
    if (timeout !== undefined) window.clearTimeout(timeout);
  };
}

function toLocalDate(timestamp: string) {
  const date = new Date(timestamp);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function getStreakDays(timestamps: string[]) {
  if (timestamps.length === 0) return 0;
  const workoutDays = [...new Set(timestamps.map(toLocalDate))].sort().reverse();
  const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  const latestWorkoutDay = dayNumber(workoutDays[0]);

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
  const isActive = useSyncExternalStore(
    (onChange) => subscribeToStreakClock(onChange, timestamps),
    () => isStreakActive(timestamps, Date.now()),
    () => null,
  );
  const streak = isActive ? getStreakDays(timestamps) : 0;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-800 dark:bg-orange-950/50 dark:text-orange-200"
      aria-live="polite"
    >
      <Flame aria-hidden="true" className="size-4" />
      {isActive === null ? "…" : `${streak} day streak`}
    </span>
  );
}
