import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DottedProgress } from "@/components/dotted-progress";
import { ExerciseGoalsCard } from "@/components/exercise-goals-card";
import { WorkoutStreak } from "@/components/workout-streak";
import { createClient } from "@/lib/supabase/server";
import { Dumbbell } from "lucide-react";

const WORKOUT_LOG_PAGE_SIZE = 1000;

async function loadWorkoutLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const logs: {
    id: number;
    exercise_id: string;
    weight: number | null;
    reps: number | null;
    created_at: string;
    workout_id: number | null;
  }[] = [];

  for (let offset = 0; ; offset += WORKOUT_LOG_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("exercise_logs")
      .select("id, exercise_id, weight, reps, created_at, workout_id")
      .eq("userprofile", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + WORKOUT_LOG_PAGE_SIZE - 1);

    if (error) return { data: null, error };

    const page = data ?? [];
    logs.push(...page);
    if (page.length < WORKOUT_LOG_PAGE_SIZE) break;
  }

  return { data: logs, error: null };
}

async function HomeDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [todosResult, projectsResult, logsResult, goalsResult] =
    await Promise.all([
      supabase
        .from("todolist")
        .select("id, completedstatus")
        .eq("userprofile", user.id),
      supabase
        .from("projects")
        .select("id, name")
        .eq("userprofile", user.id),
      loadWorkoutLogs(supabase, user.id),
      supabase
        .from("exercise_goals")
        .select("id, exercise_id, 1rm, goal_acheived, achieve_by, created_at")
        .eq("userprofile", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const todos = todosResult.data ?? [];
  const completedTasks = todos.filter((todo) => todo.completedstatus).length;
  const taskProgress = todos.length
    ? Math.round((completedTasks / todos.length) * 100)
    : 0;
  const projects = projectsResult.data ?? [];
  const logs = logsResult.data ?? [];
  const workoutTimestamps = logs.map((log) => log.created_at);
  const goals = goalsResult.data ?? [];
  const workoutCount = new Set(
    logs.map(
      (log) =>
        log.workout_id ?? `legacy-${log.created_at.slice(0, 10)}`,
    ),
  );
  const achievedGoals = goals.filter((goal) => goal.goal_acheived === true);
  const activeGoals = goals.filter(
    (goal) => goal.goal_acheived !== true && goal["1rm"] != null,
  );
  const bestEstimatedLifts = new Map<
    string,
    {
      exercise: string;
      weight: number;
      reps: number;
      estimatedOneRepMax: number;
    }
  >();

  for (const log of logs) {
    const weight = Number(log.weight);
    const reps = Number(log.reps);
    if (!log.exercise_id.trim() || !Number.isFinite(weight) || weight <= 0 ||
      !Number.isInteger(reps) || reps < 1) {
      continue;
    }

    const key = log.exercise_id.trim().toLocaleLowerCase();
    const estimatedOneRepMax = weight * (1 + reps / 30);
    const currentBest = bestEstimatedLifts.get(key);
    if (!currentBest || estimatedOneRepMax > currentBest.estimatedOneRepMax) {
      bestEstimatedLifts.set(key, {
        exercise: log.exercise_id.trim(),
        weight,
        reps,
        estimatedOneRepMax,
      });
    }
  }
  const topEstimatedLifts = [...bestEstimatedLifts.values()]
    .sort((first, second) => second.estimatedOneRepMax - first.estimatedOneRepMax)
    .slice(0, 5);
  const displayName =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : "there";

  return (
    <div className="space-y-6">
      <header className="py-2">
        <p className="text-sm font-medium text-primary">Your progress</p>
        <h1 className="mt-1 text-3xl font-bold">Welcome back, {displayName}</h1>
        <p className="mt-2 text-muted-foreground">
          A little progress, every day.
        </p>
      </header>

      {(todosResult.error || projectsResult.error || logsResult.error || goalsResult.error) && (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          Some dashboard summaries could not be loaded. Visit Tasks or Workouts to see details.
        </p>
      )}

      <section aria-label="Progress summaries" className="grid gap-4 sm:grid-cols-2">
        <article className="flex items-center justify-between rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
          <div>
            <h2 className="font-semibold">Tasks completed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {completedTasks} of {todos.length} tasks
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {projects.length} active {projects.length === 1 ? "project" : "projects"}
            </p>
          </div>
          <DottedProgress progress={taskProgress} size="compact" dotCount={20} />
        </article>

        <article className="overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Workout activity</h2>
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Dumbbell aria-hidden="true" className="size-4" />
            </span>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-bold tracking-tight">
                {workoutCount.size}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {workoutCount.size === 1 ? "workout logged" : "workouts logged"}
              </p>
            </div>
            <WorkoutStreak timestamps={workoutTimestamps} />
          </div>
        </article>

        <ExerciseGoalsCard
          achievedGoals={achievedGoals}
          activeGoalCount={activeGoals.length}
          totalGoalCount={goals.length}
        />

        <article className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Top estimated 1RMs</h2>
            <span className="text-xs text-muted-foreground">Epley estimate</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Best logged set for each exercise
          </p>
          {topEstimatedLifts.length ? (
            <ul className="mt-3 divide-y">
              {topEstimatedLifts.map((lift) => (
                <li
                  key={lift.exercise.toLocaleLowerCase()}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{lift.exercise}</span>
                    <span className="text-xs text-muted-foreground">
                      {lift.weight} lbs × {lift.reps} reps
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">
                      {new Intl.NumberFormat(undefined, {
                        maximumFractionDigits: 1,
                      }).format(lift.estimatedOneRepMax)}{" "}
                      lbs
                    </span>
                    <span className="text-xs text-muted-foreground">est. 1RM</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Log a weighted set to see your estimated 1RM.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="py-8 text-sm text-muted-foreground">Loading your dashboard...</p>}>
      <HomeDashboard />
    </Suspense>
  );
}
