import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ExerciseGoalsCard } from "@/components/exercise-goals-card";
import { WorkoutStreak } from "@/components/workout-streak";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Dumbbell,
  FolderKanban,
  Sparkles,
  TrendingUp,
} from "lucide-react";

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
  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 p-6 text-white shadow-xl shadow-sky-950/10 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-20 -z-10 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 right-1/4 -z-10 size-64 rounded-full bg-fuchsia-300/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur">
              <Sparkles aria-hidden="true" className="size-3.5" />
              YOUR DASHBOARD
            </span>
            <h1 className="mt-5 break-words text-4xl font-bold tracking-tight sm:text-6xl">
              Make today
              <span className="block text-white/85">count.</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
              Every task finished and every workout logged is a step forward.
              Keep your momentum going.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/protected?view=tasks"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-600"
              >
                <CheckCircle2 aria-hidden="true" className="size-4" />
                View my tasks
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/protected/workouts"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Dumbbell aria-hidden="true" className="size-4" />
                Log a workout
              </Link>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute -right-4 bottom-0 hidden translate-y-1/4 text-white/[0.08] sm:block"
          >
            <Dumbbell className="size-64 -rotate-12" strokeWidth={1} />
          </div>
        </div>
      </header>

      {(todosResult.error || projectsResult.error || logsResult.error || goalsResult.error) && (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Some dashboard summaries could not be loaded. Visit Tasks or Workouts to see details.
        </p>
      )}

      <section aria-label="Progress summaries" className="grid gap-4 sm:grid-cols-2">
        <article className="group relative overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                TASKS
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {completedTasks}
                <span className="ml-1 text-base font-medium text-muted-foreground">
                  / {todos.length}
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {todos.length - completedTasks} left to complete
              </p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </span>
          </div>
          <div
            className="mt-5 h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${taskProgress}% of tasks completed`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width]"
              style={{ width: `${taskProgress}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <FolderKanban aria-hidden="true" className="size-4" />
              {projects.length} active {projects.length === 1 ? "project" : "projects"}
            </span>
            <Link
              href="/protected?view=tasks"
              className="inline-flex items-center gap-1 font-semibold text-primary transition group-hover:gap-1.5"
            >
              Open tasks <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </article>

        <article className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-orange-500/10 p-5 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                TRAINING
              </p>
              <h2 className="mt-1 font-semibold">Workout activity</h2>
            </div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Dumbbell aria-hidden="true" className="size-4" />
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-bold tracking-tight sm:text-5xl">
                {workoutCount.size}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {workoutCount.size === 1 ? "workout logged" : "workouts logged"}
              </p>
            </div>
            <WorkoutStreak timestamps={workoutTimestamps} />
          </div>
          <Link
            href="/protected/workouts/history"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary transition group-hover:gap-1.5"
          >
            View workout history <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </article>

        <ExerciseGoalsCard
          achievedGoals={achievedGoals}
          activeGoalCount={activeGoals.length}
          totalGoalCount={goals.length}
        />

        <article className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <TrendingUp aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Top estimated 1RMs</h2>
                <p className="text-xs text-muted-foreground">
                  Best logged set for each exercise
                </p>
              </div>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Epley estimate
            </span>
          </div>
          {topEstimatedLifts.length ? (
            <ul className="mt-4 space-y-2">
              {topEstimatedLifts.map((lift, index) => (
                <li
                  key={lift.exercise.toLocaleLowerCase()}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-3 text-sm transition hover:bg-muted/70"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      index === 0
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-background text-muted-foreground"
                    }`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{lift.exercise}</span>
                      <span className="text-xs text-muted-foreground">
                        {lift.weight} lbs × {lift.reps} reps
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums">
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
            <p className="mt-4 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
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
