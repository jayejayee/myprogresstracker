import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { WorkoutStopwatch } from "@/components/workout-stopwatch";
import { createClient } from "@/lib/supabase/server";

async function StopwatchContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Workout stopwatch</h1>
      <WorkoutStopwatch lapLabel={null} userId={user.id} />
    </>
  );
}

export default function Page() {
  return (
    <main className="pb-8 sm:p-6 sm:pb-8">
      <Suspense
        fallback={
          <p className="py-4 text-sm text-muted-foreground">
            Loading workout stopwatch...
          </p>
        }
      >
        <StopwatchContent />
      </Suspense>
    </main>
  );
}
