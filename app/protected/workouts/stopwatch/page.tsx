"use client";

import { WorkoutStopwatch } from "@/components/workout-stopwatch";

export default function Page() {
  return (
    <main className="pb-8 sm:p-6 sm:pb-8">
      <h1 className="mb-4 text-2xl font-bold">Workout stopwatch</h1>
      <WorkoutStopwatch lapLabel={null} />
    </main>
  );
}
