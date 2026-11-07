import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExerciseGoalsCard } from "@/components/exercise-goals-card";
import { HomeDashboardFilters } from "@/components/home-dashboard-filters";
import { HomeOverallStats } from "@/components/home-overall-stats";
import { TodaysPlanCard } from "@/components/todays-plan-card";
import { TrainingRhythmCard } from "@/components/training-rhythm-card";
import { WorkoutStreak } from "@/components/workout-streak";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Dumbbell,
  FolderKanban,
  Sparkles,
  Trophy,
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
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [todosResult, projectsResult, logsResult, goalsResult, exercisesResult] =
    await Promise.all([
      supabase
        .from("todolist")
        .select("id, todo, todoby, completedstatus")
        .eq("userprofile", user.id),
      supabase
        .from("projects")
        .select("id, name, due_date")
        .eq("userprofile", user.id),
      loadWorkoutLogs(supabase, user.id),
      supabase
        .from("exercise_goals")
        .select("id, exercise_id, 1rm, goal_acheived, achieve_by, created_at")
        .eq("userprofile", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("exercises")
        .select("exercise_id, primary_muscle_group")
        .eq("userprofile", user.id),
    ]);

  const todos = todosResult.data ?? [];
  const completedTasks = todos.filter((todo) => todo.completedstatus).length;
  const taskProgress = todos.length
    ? Math.round((completedTasks / todos.length) * 100)
    : 0;
  const projects = projectsResult.data ?? [];
  const logs = logsResult.data ?? [];
  const exercises = exercisesResult.data ?? [];
  const workoutTimestamps = logs.map((log) => log.created_at);
  const goals = goalsResult.data ?? [];
  const workoutCount = new Set(
    logs.map(
      (log) =>
        log.workout_id ?? `legacy-${log.created_at.slice(0, 10)}`,
    ),
  );
  const muscleGroupByExercise = new Map(
    exercises.map((exercise) => [
      exercise.exercise_id.trim().toLocaleLowerCase(),
      exercise.primary_muscle_group.trim(),
    ]),
  );
  const muscleGroupsByLastWorkout = new Map<string, number>();
  for (const log of logs) {
    const muscleGroup = muscleGroupByExercise.get(
      log.exercise_id.trim().toLocaleLowerCase(),
    );
    if (!muscleGroup) continue;

    const timestamp = new Date(log.created_at).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const key = muscleGroup.toLocaleLowerCase();
    muscleGroupsByLastWorkout.set(
      key,
      Math.max(muscleGroupsByLastWorkout.get(key) ?? 0, timestamp),
    );
  }
  const muscleGroupBalance = [
    ...new Map(
      exercises
        .map((exercise) => exercise.primary_muscle_group.trim())
        .filter(Boolean)
        .map((group) => [group.toLocaleLowerCase(), group] as const),
    ).values(),
  ]
    .map((group) => ({
      name: group,
      lastTrained: muscleGroupsByLastWorkout.get(group.toLocaleLowerCase()) ?? null,
    }))
    .sort((first, second) => {
      if (first.lastTrained == null) return -1;
      if (second.lastTrained == null) return 1;
      return first.lastTrained - second.lastTrained;
    });
  const dashboardNow = new Date().getTime();
  const balanceCutoff = dashboardNow - 7 * 24 * 60 * 60 * 1000;
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
  const previousBestByExercise = new Map<string, number>();
  let latestPersonalRecord: {
    exercise: string;
    weight: number;
    reps: number;
    estimatedOneRepMax: number;
    previousBest: number | null;
    createdAt: string;
  } | null = null;
  const chronologicalLogs = [...logs].sort(
    (first, second) =>
      new Date(first.created_at).getTime() -
      new Date(second.created_at).getTime(),
  );

  for (const log of chronologicalLogs) {
    const weight = Number(log.weight);
    const reps = Number(log.reps);
    if (
      !log.exercise_id.trim() ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isInteger(reps) ||
      reps < 1
    ) {
      continue;
    }

    const key = log.exercise_id.trim().toLocaleLowerCase();
    const estimatedOneRepMax = weight * (1 + reps / 30);
    const previousBest = previousBestByExercise.get(key);
    if (previousBest == null || estimatedOneRepMax > previousBest) {
      latestPersonalRecord = {
        exercise: log.exercise_id.trim(),
        weight,
        reps,
        estimatedOneRepMax,
        previousBest: previousBest ?? null,
        createdAt: log.created_at,
      };
      previousBestByExercise.set(key, estimatedOneRepMax);
    }
  }

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
                href="/protected/tasks"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-600"
              >
                <CheckCircle2 aria-hidden="true" className="size-4" />
                View my tasks
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/protected/workouts/log"
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

      {(todosResult.error || projectsResult.error || logsResult.error || goalsResult.error || exercisesResult.error) && (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Some dashboard summaries could not be loaded. Visit Tasks or Workouts to see details.
        </p>
      )}

      <HomeOverallStats
        completedTasks={completedTasks}
        totalTasks={todos.length}
        activeProjects={projects.length}
        workouts={workoutCount.size}
      />
      <TodaysPlanCard
        tasks={todos.map((todo) => ({
          id: todo.id,
          title: todo.todo,
          dueDate: todo.todoby,
          completed: todo.completedstatus,
        }))}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Explore your progress</h2>
      <HomeDashboardFilters
        tasksContent={
          <section aria-label="Tasks and projects" className="grid gap-4 sm:grid-cols-2">
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
              href="/protected/tasks"
              className="inline-flex items-center gap-1 font-semibold text-primary transition group-hover:gap-1.5"
            >
              Open tasks <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                PROJECTS
              </p>
              <h2 className="mt-1 font-semibold">Your projects</h2>
            </div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FolderKanban aria-hidden="true" className="size-5" />
            </span>
          </div>
          {projects.length ? (
            <ul className="mt-3 divide-y">
              {projects.slice(0, 4).map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {project.name}
                  </span>
                  {project.due_date && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Due {project.due_date}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
              Your projects will appear here.
            </p>
          )}
          <Link
            href="/protected/projects"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            View all projects <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </article>

          </section>
        }
        workoutsContent={
          <section aria-label="Workout progress" className="grid gap-4 sm:grid-cols-2">
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

        {latestPersonalRecord && (
          <article className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 p-5 text-card-foreground shadow-sm sm:col-span-2 sm:p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-14 size-48 rounded-full bg-amber-400/15 blur-3xl"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                  <Trophy aria-hidden="true" className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    LATEST PERSONAL RECORD
                  </p>
                  <h2 className="mt-1 truncate text-lg font-bold">
                    {latestPersonalRecord.exercise}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {latestPersonalRecord.weight} lbs × {latestPersonalRecord.reps} reps
                    {" · "}
                    {new Date(latestPersonalRecord.createdAt).toLocaleDateString()}
                  </p>
                  {latestPersonalRecord.previousBest != null && (
                    <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Up{" "}
                      {new Intl.NumberFormat(undefined, {
                        maximumFractionDigits: 1,
                      }).format(
                        latestPersonalRecord.estimatedOneRepMax -
                          latestPersonalRecord.previousBest,
                      )}{" "}
                      lbs estimated 1RM from your previous best
                    </p>
                  )}
                  {latestPersonalRecord.previousBest == null && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Your first logged estimated 1RM for this exercise.
                    </p>
                  )}
                </div>
              </div>
              <div className="relative flex shrink-0 items-end gap-3">
                <div className="text-right">
                  <p className="text-3xl font-bold tracking-tight tabular-nums">
                    {new Intl.NumberFormat(undefined, {
                      maximumFractionDigits: 1,
                    }).format(latestPersonalRecord.estimatedOneRepMax)}
                    <span className="ml-1 text-sm font-semibold">lbs</span>
                  </p>
                  <p className="text-xs text-muted-foreground">estimated 1RM</p>
                </div>
                <Link
                  href="/protected/workouts/history"
                  aria-label="View workout history"
                  className="mb-0.5 flex size-9 items-center justify-center rounded-xl border bg-background/70 text-muted-foreground transition hover:bg-background hover:text-foreground"
                >
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </div>
          </article>
        )}

        <TrainingRhythmCard
          logs={logs.map((log) => ({
            createdAt: log.created_at,
            workoutId: log.workout_id,
          }))}
        />

        <article className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:col-span-2 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                RECOVERY SNAPSHOT
              </p>
              <h2 className="mt-1 text-lg font-semibold">Muscle-group balance</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Amber means it’s been 7+ days or it hasn’t been logged yet.
            </p>
          </div>
          {muscleGroupBalance.length ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {muscleGroupBalance.map((group) => {
                const needsAttention =
                  group.lastTrained == null || group.lastTrained < balanceCutoff;
                const lastTrainedLabel =
                  group.lastTrained == null
                    ? "Not logged yet"
                    : new Intl.RelativeTimeFormat(undefined, {
                        numeric: "auto",
                      }).format(
                        -Math.floor(
                          (dashboardNow - group.lastTrained) / (24 * 60 * 60 * 1000),
                        ),
                        "day",
                      );

                return (
                  <li
                    key={group.name}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${
                      needsAttention
                        ? "border-amber-500/20 bg-amber-500/[0.06]"
                        : "border-emerald-500/15 bg-emerald-500/[0.04]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`size-2.5 shrink-0 rounded-full ${
                          needsAttention ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                      <span className="truncate text-sm font-semibold">
                        {group.name}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs ${
                        needsAttention
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {lastTrainedLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              Add exercises to your library to see your muscle-group balance.
            </p>
          )}
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
        }
      />
      </div>
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
