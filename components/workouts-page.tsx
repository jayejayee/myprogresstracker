"use client";

import {
  type FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Exercise = {
  id: number;
  exercise_id: string;
  primary_muscle_group: string;
  "isolated/compound": string | null;
};

type ExerciseGoal = {
  id: number;
  exercise_id: string;
  "1rm": number | null;
  achieve_by: string | null;
  goal_acheived: boolean | null;
  created_at: string;
};

type ExerciseLog = {
  id: number;
  exercise_id: string;
  set: number | null;
  reps: number | null;
  weight: number | null;
  created_at: string;
  workout_id: number | null;
};

type WorkoutGroup = {
  key: string;
  workoutId: number | null;
  createdAt: string;
  logs: ExerciseLog[];
};

type HistoryExerciseGroup = {
  exerciseId: string;
  muscleGroup: string;
  logs: ExerciseLog[];
};

type SelectedHistoryExercise = HistoryExerciseGroup & {
  workoutDate: string;
};

type WorkoutEntry = {
  muscleGroup: string;
  exerciseId: number;
  sets: WorkoutSet[];
};

type WorkoutSet = {
  reps: string;
  weight: string;
};

type SavedWorkoutEntry = {
  exercise: Exercise;
  set: number;
  reps: number;
  weight: number;
};

type AchievedGoal = {
  exercise: Exercise;
  goalId: number;
  goalWeight: number;
  loggedWeight: number | null;
  loggedReps: number | null;
  estimatedOneRepMax: number | null;
};

type WorkoutSection = "log-workout" | "workout-history" | "exercise-goals";

const BODY_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Core",
  "Glutes",
  "Quadriceps",
  "Hamstrings",
  "Calves",
  "Full Body",
  "Other",
];

let lastWorkoutId = 0;

function createWorkoutId() {
  lastWorkoutId = Math.max(Date.now(), lastWorkoutId + 1);
  return lastWorkoutId;
}

type ExerciseCardProps = {
  exercise: Exercise;
  goals: ExerciseGoal[];
  logs: ExerciseLog[];
  onUpdateExerciseType: (
    exercise: Exercise,
    exerciseType: "compound" | "isolated",
  ) => Promise<string | null>;
  onAddGoal: (
    exercise: Exercise,
    weight: number,
    achieveBy: string,
  ) => Promise<string | null>;
  onMarkGoalAchieved: (exercise: Exercise, goal: ExerciseGoal) => Promise<void>;
};

function ExerciseCard({
  exercise,
  goals,
  logs,
  onUpdateExerciseType,
  onAddGoal,
  onMarkGoalAchieved,
}: ExerciseCardProps) {
  const [isEditingType, setIsEditingType] = useState(false);
  const [exerciseType, setExerciseType] = useState(
    exercise["isolated/compound"] ?? "",
  );
  const [isSavingType, setIsSavingType] = useState(false);
  const [goalWeight, setGoalWeight] = useState("");
  const [achieveBy, setAchieveBy] = useState("");
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [isMarkingAchieved, setIsMarkingAchieved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveExerciseType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (exerciseType !== "compound" && exerciseType !== "isolated") {
      setMessage("Choose compound or isolated.");
      return;
    }

    setIsSavingType(true);
    setMessage(null);
    const error = await onUpdateExerciseType(exercise, exerciseType);
    setIsSavingType(false);
    if (error) {
      setMessage(error);
      return;
    }

    setMessage("Exercise type updated.");
    setIsEditingType(false);
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weight = Number(goalWeight);
    if (!Number.isFinite(weight) || weight <= 0) {
      setMessage("Enter a target weight greater than zero.");
      return;
    }

    setIsSavingGoal(true);
    setMessage(null);
    const error = await onAddGoal(exercise, weight, achieveBy);
    setMessage(error ?? "Goal saved.");
    if (!error) {
      setGoalWeight("");
      setAchieveBy("");
      setIsGoalFormOpen(false);
    }
    setIsSavingGoal(false);
  }

  const latestGoal = goals[0];
  const targetWeight = latestGoal?.["1rm"];
  const isGoalAchieved =
    latestGoal?.goal_acheived === true ||
    (targetWeight != null &&
      logs.some(
        (log) =>
          (calculateEstimatedOneRepMax(log.weight, log.reps) ?? 0) >= targetWeight,
      ));
  const latestWorkoutSets = getPreviousWorkoutSets(logs, exercise.exercise_id);
  const bestEstimatedOneRepMax = logs.reduce<number | null>((best, log) => {
    const estimate = calculateEstimatedOneRepMax(log.weight, log.reps);
    return estimate != null && (best == null || estimate > best) ? estimate : best;
  }, null);

  async function handleGoalAction() {
    if (!latestGoal) {
      setIsGoalFormOpen((open) => !open);
      return;
    }

    setIsMarkingAchieved(true);
    await onMarkGoalAchieved(exercise, latestGoal);
    setIsMarkingAchieved(false);
  }

  return (
    <article className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Exercise
      </p>
      <h3 className="mt-1 break-words text-lg font-semibold">
        {exercise.exercise_id || "Unnamed exercise"}
      </h3>
      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Primary muscle group
        </p>
        <p className="mt-1 break-words text-sm font-medium">
          {exercise.primary_muscle_group || "Not specified"}
        </p>
      </div>
      <div className="mt-3">
        {isEditingType ? (
          <form onSubmit={saveExerciseType} className="grid gap-2">
            <label className="grid gap-1 text-xs font-medium">
              Exercise type
              <select
                value={exerciseType}
                onChange={(event) => setExerciseType(event.target.value)}
                required
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="" disabled>Select exercise type</option>
                <option value="compound">Compound</option>
                <option value="isolated">Isolated</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSavingType}
                className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSavingType ? "Saving..." : "Save type"}
              </button>
              <button
                type="button"
                disabled={isSavingType}
                onClick={() => {
                  setExerciseType(exercise["isolated/compound"] ?? "");
                  setIsEditingType(false);
                }}
                className="h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Type: </span>
              <span className="font-medium">
                {exercise["isolated/compound"] || "Not set"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setExerciseType(exercise["isolated/compound"] ?? "");
                setIsEditingType(true);
                setMessage(null);
              }}
              className="h-8 shrink-0 rounded-md border px-3 text-xs font-medium hover:bg-accent"
            >
              Change
            </button>
          </div>
        )}
      </div>
      {bestEstimatedOneRepMax != null && (
        <p className="mt-3 text-sm">
          Best estimated 1RM:{" "}
          <span className="font-semibold">
            {formatLoggedWeight(bestEstimatedOneRepMax)} lbs
          </span>
        </p>
      )}

      <section className="mt-5 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold">Weight goal (1RM)</h4>
          <button
            type="button"
            aria-expanded={latestGoal ? undefined : isGoalFormOpen}
            onClick={handleGoalAction}
            disabled={isMarkingAchieved}
            className="h-8 shrink-0 rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {isMarkingAchieved
              ? "Opening..."
              : latestGoal
                ? isGoalAchieved
                  ? "Goal achieved! Set a new goal"
                  : "Mark goal achieved"
                : isGoalFormOpen
                  ? "Cancel"
                  : "Add goal"}
          </button>
        </div>
        {latestGoal ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Target: {latestGoal["1rm"] ?? "—"}
            {latestGoal.achieve_by
              ? ` by ${latestGoal.achieve_by}`
              : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No goal set yet.</p>
        )}
        {isGoalAchieved && (
          <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Goal achieved!
          </p>
        )}
        {isGoalFormOpen && (
          <form onSubmit={saveGoal} className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium">
              Target weight
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={goalWeight}
                onChange={(event) => setGoalWeight(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                placeholder="e.g. 100"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Target date (optional)
              <input
                type="date"
                value={achieveBy}
                onChange={(event) => setAchieveBy(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
          <button
            type="submit"
            disabled={isSavingGoal}
            className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:col-span-2"
          >
            {isSavingGoal ? "Saving..." : "Save goal"}
          </button>
          </form>
        )}
      </section>

      {latestWorkoutSets.length > 0 && (
        <section className="mt-4 border-t pt-3">
          <h4 className="text-sm font-semibold">Last workout · estimated 1RM</h4>
          <ul className="mt-2 space-y-1">
            {latestWorkoutSets.map((log) => {
              const estimatedOneRepMax = calculateEstimatedOneRepMax(
                log.weight,
                log.reps,
              );
              return (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-muted-foreground">
                    Set {log.set ?? "—"} · {formatLoggedWeight(log.weight)} lbs ×{" "}
                    {log.reps ?? "—"} reps
                  </span>
                  <span className="shrink-0 font-medium">
                    {estimatedOneRepMax == null
                      ? "—"
                      : `${formatLoggedWeight(estimatedOneRepMax)} lbs`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {message && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </article>
  );
}

type GoalAchievementDialogProps = {
  achievement: AchievedGoal;
  onAddGoal: (
    exercise: Exercise,
    weight: number,
    achieveBy: string,
  ) => Promise<string | null>;
  onClose: () => void;
};

function GoalAchievementDialog({
  achievement,
  onAddGoal,
  onClose,
}: GoalAchievementDialogProps) {
  const [goalWeight, setGoalWeight] = useState("");
  const [achieveBy, setAchieveBy] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveNextGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weight = Number(goalWeight);
    const achievedWeight = Math.max(
      achievement.goalWeight,
      achievement.estimatedOneRepMax ?? achievement.goalWeight,
    );
    if (!Number.isFinite(weight) || weight <= achievedWeight) {
      setMessage(
        `Enter a new target greater than ${achievedWeight}.`,
      );
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const error = await onAddGoal(achievement.exercise, weight, achieveBy);
    if (error) {
      setMessage(error);
    } else {
      setSaved(true);
      setMessage("Your next goal is set. Keep building!");
    }
    setIsSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-achievement-title"
        className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-xl"
      >
        <div aria-hidden="true" className="mb-3 text-4xl">🎉</div>
        <h2 id="goal-achievement-title" className="text-2xl font-bold">
          Congratulations!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {achievement.loggedWeight == null || achievement.loggedReps == null ? (
            <>
              You marked your {achievement.exercise.exercise_id} goal of{" "}
              {achievement.goalWeight} as achieved.
            </>
          ) : (
            <>
              You reached your {achievement.exercise.exercise_id} goal of{" "}
              {achievement.goalWeight} with a logged weight of{" "}
              {achievement.loggedWeight} lbs × {achievement.loggedReps} reps
              (estimated 1RM:{" "}
              {formatLoggedWeight(achievement.estimatedOneRepMax)} lbs).
            </>
          )}{" "}
          Ready to set a new goal?
        </p>

        {saved ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-5 h-10 rounded-md bg-primary px-4 font-medium text-primary-foreground"
          >
            Done
          </button>
        ) : (
          <form onSubmit={saveNextGoal} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              New target weight
              <input
                type="number"
                min={
                  Math.max(
                    achievement.goalWeight,
                    achievement.estimatedOneRepMax ?? achievement.goalWeight,
                  ) + 0.01
                }
                step="0.01"
                required
                value={goalWeight}
                onChange={(event) => setGoalWeight(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3"
                placeholder="Set a higher target"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Target date (optional)
              <input
                type="date"
                value={achieveBy}
                onChange={(event) => setAchieveBy(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3"
              />
            </label>
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
              >
                Maybe later
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Set new goal"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function getLocalDate() {
  const now = new Date();
  const offset = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return offset.toISOString().slice(0, 10);
}

function subscribeToLocalDate(onChange: () => void) {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const timeout = window.setTimeout(
    onChange,
    tomorrow.getTime() - now.getTime(),
  );
  return () => window.clearTimeout(timeout);
}

type WorkoutFormProps = {
  exercises: Exercise[];
  logs: ExerciseLog[];
  onSave: (entries: SavedWorkoutEntry[]) => Promise<string | null>;
};

function getPreviousWorkoutSets(
  logs: ExerciseLog[],
  exerciseId: string,
): ExerciseLog[] {
  const workouts = new Map<string, { createdAt: string; logs: ExerciseLog[] }>();
  const normalizedExerciseId = exerciseId.trim().toLocaleLowerCase();

  for (const log of logs) {
    if (log.exercise_id.trim().toLocaleLowerCase() !== normalizedExerciseId) {
      continue;
    }

    const key =
      log.workout_id == null
        ? `legacy-${log.created_at.slice(0, 10)}`
        : `workout-${log.workout_id}`;
    const workout = workouts.get(key);
    if (workout) {
      workout.logs.push(log);
      if (new Date(log.created_at) > new Date(workout.createdAt)) {
        workout.createdAt = log.created_at;
      }
    } else {
      workouts.set(key, { createdAt: log.created_at, logs: [log] });
    }
  }

  const mostRecentWorkout = [...workouts.values()].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() -
      new Date(first.createdAt).getTime(),
  )[0];

  return mostRecentWorkout?.logs.sort(
    (first, second) => (first.set ?? 0) - (second.set ?? 0),
  ) ?? [];
}

function getSetSuggestion(
  previousSet: ExerciseLog | undefined,
) {
  if (
    !previousSet ||
    previousSet.weight == null ||
    previousSet.weight <= 0 ||
    previousSet.reps == null ||
    previousSet.reps < 1
  ) {
    return null;
  }

  const minimumReps = 8;
  const maximumReps = 12;

  if (previousSet.reps < minimumReps) {
    return {
      weight: Math.round(previousSet.weight * 0.95 * 10) / 10,
      reps: minimumReps,
    };
  }

  if (previousSet.reps >= maximumReps) {
    return {
      weight: Math.round(previousSet.weight * 1.025 * 10) / 10,
      reps: minimumReps,
    };
  }

  return {
    weight: previousSet.weight,
    reps: Math.min(previousSet.reps + 1, maximumReps),
  };
}

function isWorkoutSetComplete(set: WorkoutSet | undefined) {
  if (!set || set.reps.trim() === "" || set.weight.trim() === "") return false;

  const reps = Number(set.reps);
  const weight = Number(set.weight);
  return (
    Number.isInteger(reps) &&
    reps >= 1 &&
    Number.isFinite(weight) &&
    weight >= 0
  );
}

function formatLoggedWeight(weight: number | null) {
  return weight == null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(weight);
}

function calculateEstimatedOneRepMax(
  weight: number | null,
  reps: number | null,
) {
  if (
    weight == null ||
    reps == null ||
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1
  ) {
    return null;
  }

  return weight * (1 + reps / 30);
}

function WorkoutForm({ exercises, logs, onSave }: WorkoutFormProps) {
  const workoutDate = useSyncExternalStore(
    subscribeToLocalDate,
    getLocalDate,
    () => "",
  );
  const [entries, setEntries] = useState<WorkoutEntry[]>([
    { muscleGroup: "", exerciseId: 0, sets: [{ reps: "", weight: "" }] },
  ]);
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);
  const [selectionDraft, setSelectionDraft] = useState({
    muscleGroup: "",
    exerciseId: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const muscleGroups = [
    ...BODY_GROUPS,
    ...new Set(
      exercises
        .map((exercise) => exercise.primary_muscle_group.trim())
        .filter((group) => group && !BODY_GROUPS.includes(group)),
    ),
  ];
  function updateEntry(index: number, patch: Partial<WorkoutEntry>) {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<WorkoutSet>,
  ) {
    setEntries((current) =>
      current.map((entry, index) =>
        index === exerciseIndex
          ? {
              ...entry,
              sets: entry.sets.map((set, index) =>
                index === setIndex ? { ...set, ...patch } : set,
              ),
            }
          : entry,
      ),
    );
  }

  function openSelectionEditor(index: number, entry: WorkoutEntry) {
    setSelectionDraft({
      muscleGroup: entry.muscleGroup,
      exerciseId: entry.exerciseId,
    });
    setEditingEntryIndex(index);
  }

  function saveSelection() {
    if (editingEntryIndex == null || !selectionDraft.muscleGroup || !selectionDraft.exerciseId) {
      return;
    }

    updateEntry(editingEntryIndex, selectionDraft);
    setEditingEntryIndex(null);
  }

  async function submitWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const savedEntries: SavedWorkoutEntry[] = [];

    for (const entry of entries) {
      const exercise = exercises.find(
        (available) =>
          available.id === entry.exerciseId &&
          available.primary_muscle_group.trim() === entry.muscleGroup,
      );
      if (!exercise) {
        setMessage("Choose an exercise for every exercise section.");
        return;
      }

      for (const [setIndex, set] of entry.sets.entries()) {
        const parsedReps = Number(set.reps);
        const parsedWeight = Number(set.weight);
        if (
          !Number.isInteger(parsedReps) ||
          parsedReps < 1 ||
          !Number.isFinite(parsedWeight) ||
          parsedWeight < 0
        ) {
          setMessage("Enter valid reps and weight for every set.");
          return;
        }

        savedEntries.push({
          exercise,
          set: setIndex + 1,
          reps: parsedReps,
          weight: parsedWeight,
        });
      }
    }

    setIsSaving(true);
    setMessage(null);
    const error = await onSave(savedEntries);
    setMessage(error ?? "Workout logged.");
    if (!error) {
      setEntries([
        { muscleGroup: "", exerciseId: 0, sets: [{ reps: "", weight: "" }] },
      ]);
    }
    setIsSaving(false);
  }

  const canContinueWorkout = entries.every((entry) => {
    const firstSet = entry.sets[0];
    const exerciseSelected = exercises.some(
      (exercise) =>
        exercise.id === entry.exerciseId &&
        exercise.primary_muscle_group.trim() === entry.muscleGroup,
    );
    if (!firstSet || !exerciseSelected) return false;

    const reps = Number(firstSet.reps);
    const weight = Number(firstSet.weight);
    return (
      firstSet.reps.trim() !== "" &&
      Number.isInteger(reps) &&
      reps >= 1 &&
      firstSet.weight.trim() !== "" &&
      Number.isFinite(weight) &&
      weight >= 0
    );
  });
  return (
    <section id="log-workout" className="mb-8 scroll-mt-6 bg-card text-card-foreground sm:rounded-xl sm:border sm:p-5 sm:shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Workout tracker</h1>
        <label className="inline-flex items-center gap-2 rounded-full bg-muted/40 py-1 pl-3 pr-2 text-xs font-medium text-muted-foreground">
          <span>Workout date</span>
          <input
            type="date"
            value={workoutDate}
            readOnly
            aria-label="Workout date"
            className="h-8 w-[9.25rem] rounded-md border-0 bg-transparent px-1 text-sm font-semibold text-foreground"
          />
        </label>
      </div>
      <form onSubmit={submitWorkout} className="grid w-full gap-3 sm:max-w-2xl sm:gap-4">
        {entries.map((entry, index) => {
          const selectedExercise = exercises.find(
            (exercise) => exercise.id === entry.exerciseId,
          );
          const previousSets = selectedExercise
            ? getPreviousWorkoutSets(logs, selectedExercise.exercise_id)
            : [];
          const previousDate = previousSets[0]
            ? new Date(previousSets[0].created_at).toLocaleDateString()
            : null;

          return (
            <fieldset key={index} className="min-w-0 overflow-hidden rounded-xl border border-primary/20 bg-card pb-2 sm:p-0 sm:shadow-sm">
            <legend className="sr-only">Exercise {index + 1}</legend>
            <div className="flex flex-wrap items-center gap-2 border-b border-primary/10 bg-muted/30 px-3 py-3 sm:gap-3 sm:rounded-t-xl sm:bg-muted/40 sm:px-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              {selectedExercise && entry.muscleGroup && (
                <>
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Body group
                      </p>
                      <p className="break-words text-sm font-semibold leading-tight">{entry.muscleGroup}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Exercise
                      </p>
                      <p className="break-words text-sm font-semibold leading-tight">
                        {selectedExercise.exercise_id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSelectionEditor(index, entry)}
                    disabled={isSaving}
                    className="ml-auto h-10 shrink-0 rounded-md border-0 bg-muted/50 px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 sm:border sm:bg-background"
                  >
                    Change
                  </button>
                </>
              )}
              {!(selectedExercise && entry.muscleGroup) && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Exercise {index + 1}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {entry.muscleGroup || "Choose body group and exercise"}
                  </p>
                </div>
              )}
            </div>
            {!(selectedExercise && entry.muscleGroup) && (
              <div className="grid gap-2 px-3 py-3 sm:grid-cols-2 sm:gap-3 sm:p-4">
            <label className="grid content-start gap-2 rounded-lg bg-muted/25 p-3 text-xs font-semibold sm:border sm:bg-background sm:p-4">
              <span className="flex items-center gap-2 uppercase tracking-wide">
                <span className="flex size-5 items-center justify-center rounded-full bg-sky-100 text-[10px] text-sky-800 dark:bg-sky-900 dark:text-sky-100">1</span>
                Body group
              </span>
              <span className="font-normal text-muted-foreground">
                Choose which area you trained.
              </span>
              <select
                value={entry.muscleGroup}
                onChange={(event) => {
                  updateEntry(index, {
                    muscleGroup: event.target.value,
                    exerciseId: 0,
                  });
                  setMessage(null);
                }}
                required
                className="h-11 rounded-md border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="" disabled>Select a body group</option>
                {muscleGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label className="grid content-start gap-2 rounded-lg bg-muted/25 p-3 text-xs font-semibold sm:border sm:bg-background sm:p-4">
              <span className="flex items-center gap-2 uppercase tracking-wide">
                <span className="flex size-5 items-center justify-center rounded-full bg-violet-100 text-[10px] text-violet-800 dark:bg-violet-900 dark:text-violet-100">2</span>
                Exercise
              </span>
              <span className="font-normal text-muted-foreground">
                Pick a movement for this body group.
              </span>
              <select
                value={entry.exerciseId || ""}
                onChange={(event) =>
                  updateEntry(index, { exerciseId: Number(event.target.value) || 0 })
                }
                required
                disabled={!entry.muscleGroup}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="" disabled>
                  {entry.muscleGroup ? "Select an exercise" : "Choose a body group first"}
                </option>
                {exercises
                  .filter(
                    (exercise) =>
                      exercise.primary_muscle_group.trim() === entry.muscleGroup,
                  )
                  .map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.exercise_id}
                  </option>
                  ))}
              </select>
            </label>
            </div>
            )}
            {selectedExercise && entry.muscleGroup && (
            <section aria-label={`Sets for ${selectedExercise.exercise_id}`} className="px-3 py-3 sm:border-t sm:bg-muted/15 sm:p-4">
            <div className="grid gap-2 sm:gap-3">
              {entry.sets.map((set, setIndex) => {
                const previousSet = selectedExercise
                  ? previousSets.find(
                      (previous) => previous.set === setIndex + 1,
                    ) ??
                    (setIndex === 0
                      ? previousSets.find((previous) => previous.set == null)
                      : undefined) ??
                    (setIndex >= previousSets.length
                      ? previousSets[previousSets.length - 1]
                      : undefined)
                  : undefined;
                const suggestion = getSetSuggestion(previousSet);
                const currentWeight = Number(set.weight);
                const currentReps = Number(set.reps);
                const currentEstimatedOneRepMax = calculateEstimatedOneRepMax(
                  currentWeight,
                  currentReps,
                );

                return (
                  <div key={setIndex} className="grid min-w-0 gap-2 border-b border-muted-foreground/15 bg-transparent py-3 last:border-b-0 sm:rounded-lg sm:border sm:bg-background sm:p-3 sm:shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-7 items-center rounded-md bg-emerald-100 px-2 text-xs font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">
                      Set {setIndex + 1}
                    </span>
                    {entry.sets.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove set ${setIndex + 1}`}
                        onClick={() =>
                          updateEntry(index, {
                            sets: entry.sets.filter(
                              (_, currentSetIndex) => currentSetIndex !== setIndex,
                            ),
                          })
                        }
                        className="min-h-9 rounded-md px-2 text-xs text-destructive hover:bg-destructive/10 sm:min-h-8"
                      >
                        Remove set
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <label className="grid min-w-0 gap-1 text-xs font-semibold">
                      Weight
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={set.weight}
                        placeholder={
                          suggestion
                            ? `Suggested: ${formatLoggedWeight(suggestion.weight)}`
                            : undefined
                        }
                        onChange={(event) =>
                          updateSet(index, setIndex, { weight: event.target.value })
                        }
                        className="h-11 min-w-0 rounded-md border border-input bg-background px-2 text-base sm:px-3 sm:text-sm"
                      />
                    </label>
                    <label className="grid min-w-0 gap-1 text-xs font-semibold">
                      Reps
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={set.reps}
                        placeholder={
                          suggestion ? `Suggested: ${suggestion.reps}` : undefined
                        }
                        onChange={(event) =>
                          updateSet(index, setIndex, { reps: event.target.value })
                        }
                        className="h-11 min-w-0 rounded-md border border-input bg-background px-2 text-base sm:px-3 sm:text-sm"
                      />
                    </label>
                  </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-md bg-muted px-2 py-2 text-[11px] leading-relaxed sm:px-3 sm:text-xs">
                          <p className="font-semibold">
                            Last time{previousDate ? ` · ${previousDate}` : ""}
                          </p>
                          {previousSet ? (
                            <>
                              <p className="mt-1">
                                {formatLoggedWeight(previousSet.weight)} lbs ×{" "}
                                {previousSet.reps ?? "—"} reps
                              </p>
                              <p className="mt-0.5 text-muted-foreground">
                                Est. 1RM:{" "}
                                {formatLoggedWeight(
                                  calculateEstimatedOneRepMax(
                                    previousSet.weight,
                                    previousSet.reps,
                                  ),
                                )}{" "}
                                lbs
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-muted-foreground">
                              {selectedExercise
                                ? previousSets.length
                                  ? `No Set ${setIndex + 1} recorded.`
                                  : "No previous workout."
                                : "Select an exercise to compare."}
                            </p>
                          )}
                        </div>
                        <div className="min-w-0 rounded-md border border-primary/20 bg-primary/5 px-2 py-2 text-[11px] leading-relaxed sm:px-3 sm:text-xs">
                          <p className="font-semibold">This set</p>
                          {currentEstimatedOneRepMax != null ? (
                            <>
                              <p className="mt-1">
                                {formatLoggedWeight(currentWeight)} lbs ×{" "}
                                {currentReps} reps
                              </p>
                              <p className="mt-0.5 font-medium text-primary">
                                Est. 1RM:{" "}
                                {formatLoggedWeight(currentEstimatedOneRepMax)} lbs
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-muted-foreground">
                              Enter weight and reps to see estimate.
                            </p>
                          )}
                        </div>
                      </div>
                  </div>
                );
              })}
              {isWorkoutSetComplete(entry.sets[entry.sets.length - 1]) && (
                <button
                  type="button"
                  onClick={() =>
                    updateEntry(index, {
                      sets: [...entry.sets, { reps: "", weight: "" }],
                    })
                  }
                  disabled={isSaving}
                  className="h-10 w-full rounded-md border border-dashed px-3 text-sm font-medium hover:bg-background disabled:opacity-50 sm:w-auto"
                >
                  Add set
                </button>
              )}
            </div>
            </section>
            )}
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index))
                }
                className="self-end text-left text-sm text-destructive sm:justify-self-start"
              >
                Remove exercise
              </button>
            )}
            {editingEntryIndex === index && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !isSaving) {
                    setEditingEntryIndex(null);
                  }
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={`change-exercise-title-${index}`}
                  className="w-full max-w-md rounded-xl border bg-card p-5 text-card-foreground shadow-xl"
                >
                  <h2
                    id={`change-exercise-title-${index}`}
                    className="text-lg font-semibold"
                  >
                    Change body group or exercise
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Update the selection for this workout entry.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1.5 text-sm font-medium">
                      Body group
                      <select
                        value={selectionDraft.muscleGroup}
                        onChange={(event) =>
                          setSelectionDraft({
                            muscleGroup: event.target.value,
                            exerciseId: 0,
                          })
                        }
                        className="h-10 rounded-md border border-input bg-background px-3"
                      >
                        <option value="" disabled>Select a body group</option>
                        {muscleGroups.map((group) => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      Exercise
                      <select
                        value={selectionDraft.exerciseId || ""}
                        onChange={(event) =>
                          setSelectionDraft((current) => ({
                            ...current,
                            exerciseId: Number(event.target.value) || 0,
                          }))
                        }
                        disabled={!selectionDraft.muscleGroup}
                        className="h-10 rounded-md border border-input bg-background px-3"
                      >
                        <option value="" disabled>
                          {selectionDraft.muscleGroup
                            ? "Select an exercise"
                            : "Choose a body group first"}
                        </option>
                        {exercises
                          .filter(
                            (exercise) =>
                              exercise.primary_muscle_group.trim() ===
                              selectionDraft.muscleGroup,
                          )
                          .map((exercise) => (
                            <option key={exercise.id} value={exercise.id}>
                              {exercise.exercise_id}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingEntryIndex(null)}
                      className="h-10 rounded-md border px-4 text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveSelection}
                      disabled={!selectionDraft.muscleGroup || !selectionDraft.exerciseId}
                      className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Save selection
                    </button>
                  </div>
                </section>
              </div>
            )}
            </fieldset>
          );
        })}

        {canContinueWorkout && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setEntries((current) => [
                ...current,
                {
                  muscleGroup: current[current.length - 1]?.muscleGroup ?? "",
                  exerciseId: 0,
                  sets: [{ reps: "", weight: "" }],
                },
              ])
            }
            disabled={isSaving}
            className="min-h-11 flex-1 rounded-md border border-violet-300 bg-violet-50 px-3 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 sm:flex-none sm:px-4 sm:text-sm dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950"
          >
            Add another exercise
          </button>
          <button
            type="button"
            onClick={() =>
              setEntries((current) => [
                ...current,
                {
                  muscleGroup: "",
                  exerciseId: 0,
                  sets: [{ reps: "", weight: "" }],
                },
              ])
            }
            disabled={isSaving}
            className="min-h-11 flex-1 rounded-md border border-sky-300 bg-sky-50 px-3 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50 sm:flex-none sm:px-4 sm:text-sm dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950"
          >
            Add another body group
          </button>
          <button
            type="submit"
            disabled={isSaving || exercises.length === 0}
            className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {isSaving ? "Saving workout..." : "Save workout"}
          </button>
        </div>
        )}
      </form>
      {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}

export function WorkoutsPage({ section }: { section: WorkoutSection }) {
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseType, setExerciseType] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState("");
  const [userExercises, setUserExercises] = useState<Exercise[]>([]);
  const [exerciseGoals, setExerciseGoals] = useState<ExerciseGoal[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [selectedHistoryExercise, setSelectedHistoryExercise] =
    useState<SelectedHistoryExercise | null>(null);
  const [achievement, setAchievement] = useState<AchievedGoal | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);

  useEffect(() => {
    async function loadWorkoutData() {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setErrorMessage(userError.message);
        setIsLoading(false);
        return;
      }

      if (!user) {
        setErrorMessage("Sign in to view your exercises.");
        setIsLoading(false);
        return;
      }

      const [exercisesResult, goalsResult, logsResult] = await Promise.all([
        supabase
          .from("exercises")
          .select('id, exercise_id, primary_muscle_group, "isolated/compound"')
          .eq("userprofile", user.id)
          .order("id", { ascending: false }),
        supabase
          .from("exercise_goals")
          .select("id, exercise_id, 1rm, achieve_by, goal_acheived, created_at")
          .eq("userprofile", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("exercise_logs")
          .select("id, exercise_id, set, reps, weight, created_at, workout_id")
          .eq("userprofile", user.id)
          .order("created_at", { ascending: false }),
      ]);

      setUserExercises(exercisesResult.data ?? []);
      setExerciseGoals(goalsResult.data ?? []);
      setExerciseLogs(logsResult.data ?? []);
      const queryError =
        exercisesResult.error ?? goalsResult.error ?? logsResult.error;
      if (queryError) setErrorMessage(queryError.message);
      setIsLoading(false);
    }

    loadWorkoutData();
  }, []);

  async function getCurrentUser() {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { supabase, user, error };
  }

  async function addExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsAddingExercise(true);
    const { supabase, user, error: userError } = await getCurrentUser();

    if (userError || !user) {
      setErrorMessage(userError?.message ?? "Sign in to add an exercise.");
      setIsAddingExercise(false);
      return;
    }

    const { data, error } = await supabase
      .from("exercises")
      .insert({
        primary_muscle_group: primaryMuscleGroup.trim(),
        exercise_id: exerciseName.trim(),
        "isolated/compound": exerciseType,
        userprofile: user.id,
      })
      .select('id, exercise_id, primary_muscle_group, "isolated/compound"')
      .single();

    if (error) {
      setErrorMessage(error.message);
    } else {
      setUserExercises((previous) => [data, ...previous]);
      setExerciseName("");
      setPrimaryMuscleGroup("");
      setExerciseType("");
      setIsAddExerciseOpen(false);
    }
    setIsAddingExercise(false);
  }

  async function updateExerciseType(
    exercise: Exercise,
    exerciseType: "compound" | "isolated",
  ) {
    const { supabase, user, error: userError } = await getCurrentUser();
    if (userError || !user) {
      return userError?.message ?? "Sign in to update this exercise.";
    }

    const { data, error } = await supabase
      .from("exercises")
      .update({ "isolated/compound": exerciseType })
      .eq("id", exercise.id)
      .eq("userprofile", user.id)
      .select('id, exercise_id, primary_muscle_group, "isolated/compound"')
      .maybeSingle();

    if (error) return error.message;
    if (!data) {
      return "No exercise was updated. Check that Supabase allows you to update your own exercises; see supabase/exercise-type-update.sql.";
    }

    setUserExercises((current) =>
      current.map((item) => (item.id === data.id ? data : item)),
    );
    return null;
  }

  async function addGoal(
    exercise: Exercise,
    weight: number,
    achieveBy: string,
  ) {
    const { supabase, user, error: userError } = await getCurrentUser();
    if (userError || !user) {
      return userError?.message ?? "Sign in to save a goal.";
    }

    const { data, error } = await supabase
      .from("exercise_goals")
      .insert({
        exercise_id: exercise.exercise_id,
        "1rm": weight,
        achieve_by: achieveBy || null,
        userprofile: user.id,
      })
      .select("id, exercise_id, 1rm, achieve_by, goal_acheived, created_at")
      .single();

    if (error) return error.message;
    setExerciseGoals((previous) => [data, ...previous]);
    return null;
  }

  async function markGoalAchieved(
    exercise: Exercise,
    goal: ExerciseGoal,
    loggedSet: {
      weight: number;
      reps: number;
      estimatedOneRepMax: number;
    } | null = null,
  ) {
    setAchievement({
      exercise,
      goalId: goal.id,
      goalWeight: goal["1rm"] ?? 0,
      loggedWeight: loggedSet?.weight ?? null,
      loggedReps: loggedSet?.reps ?? null,
      estimatedOneRepMax: loggedSet?.estimatedOneRepMax ?? null,
    });
    setExerciseGoals((previous) =>
      previous.map((currentGoal) =>
        currentGoal.id === goal.id
          ? { ...currentGoal, goal_acheived: true }
          : currentGoal,
      ),
    );

    const { supabase, user, error: userError } = await getCurrentUser();
    if (userError || !user) {
      setErrorMessage(
        `Goal marked achieved for this session, but could not be saved: ${
          userError?.message ?? "Sign in to save goal status."
        }`,
      );
      return;
    }

    const { data: updatedGoal, error } = await supabase
      .from("exercise_goals")
      .update({ goal_acheived: true })
      .eq("id", goal.id)
      .eq("userprofile", user.id)
      .select("id, exercise_id, 1rm, achieve_by, goal_acheived, created_at")
      .single();

    if (error) {
      setErrorMessage(
        `Goal marked achieved for this session, but could not be saved: ${error.message}`,
      );
      return;
    }

    setExerciseGoals((previous) =>
      previous.map((currentGoal) =>
        currentGoal.id === updatedGoal.id ? updatedGoal : currentGoal,
      ),
    );
    setErrorMessage(null);
  }

  async function addWorkout(entries: SavedWorkoutEntry[]) {
    const { supabase, user, error: userError } = await getCurrentUser();
    if (userError || !user) {
      return userError?.message ?? "Sign in to log a workout.";
    }

    const createdAt = new Date().toISOString();
    const workoutId = createWorkoutId();
    const { data, error } = await supabase
      .from("exercise_logs")
      .insert(
        entries.map(({ exercise, set, reps, weight }) => ({
          exercise_id: exercise.exercise_id,
          set,
          reps,
          weight,
          workout_id: workoutId,
          userprofile: user.id,
          created_at: createdAt,
        })),
      )
      .select("id, exercise_id, set, reps, weight, created_at, workout_id");

    if (error) return error.message;
    setExerciseLogs((previous) =>
      [...(data ?? []), ...previous].sort(
        (first, second) =>
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime(),
      ),
    );

    for (const { exercise, weight, reps } of entries) {
      const goal = exerciseGoals.find(
        (candidate) => candidate.exercise_id === exercise.exercise_id,
      );
      const targetWeight = goal?.["1rm"];
      const estimatedOneRepMax = calculateEstimatedOneRepMax(weight, reps);
      if (
        !goal ||
        targetWeight == null ||
        estimatedOneRepMax == null ||
        estimatedOneRepMax < targetWeight ||
        goal.goal_acheived === true
      ) {
        continue;
      }

      await markGoalAchieved(exercise, goal, {
        weight,
        reps,
        estimatedOneRepMax,
      });
      break;
    }

    return null;
  }

  function getExerciseForLog(log: ExerciseLog) {
    return userExercises.find(
      (exercise) => exercise.exercise_id === log.exercise_id,
    );
  }

  const muscleGroups = [
    ...BODY_GROUPS,
    ...new Set(
      userExercises
        .map((exercise) => exercise.primary_muscle_group.trim())
        .filter((group) => group && !BODY_GROUPS.includes(group)),
    ),
  ];
  const filteredExercises = userExercises.filter((exercise) => {
    const matchesGroup =
      !muscleGroupFilter ||
      exercise.primary_muscle_group.trim() === muscleGroupFilter;
    const matchesSearch = exercise.exercise_id
      .toLocaleLowerCase()
      .includes(exerciseSearch.trim().toLocaleLowerCase());
    return matchesGroup && matchesSearch;
  });
  const groupedWorkouts = exerciseLogs.reduce<WorkoutGroup[]>((groups, log) => {
    const key =
      log.workout_id == null
        ? `legacy-${log.created_at.slice(0, 10)}`
        : `workout-${log.workout_id}`;
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) {
      group = {
        key,
        workoutId: log.workout_id,
        createdAt: log.created_at,
        logs: [],
      };
      groups.push(group);
    }
    group.logs.push(log);
    if (new Date(log.created_at) > new Date(group.createdAt)) {
      group.createdAt = log.created_at;
    }
    return groups;
  }, []);
  groupedWorkouts.sort(
    (first, second) =>
      new Date(second.createdAt).getTime() -
      new Date(first.createdAt).getTime(),
  );

  return (
    <main className="pb-8 sm:p-6 sm:pb-8">
      {section !== "log-workout" && (
        <h1 className="mb-4 text-2xl font-bold">Workout tracker</h1>
      )}

      {section === "log-workout" && (
        <WorkoutForm
          exercises={userExercises}
          logs={exerciseLogs}
          onSave={addWorkout}
        />
      )}
      {errorMessage && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      {section === "workout-history" && <section className="mb-8 max-w-2xl">
          <h2 className="mb-3 text-xl font-bold">Recent workout log</h2>
          {groupedWorkouts.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {groupedWorkouts.slice(0, 20).map((workout, index) => {
                const exercisesInWorkout = workout.logs.reduce<
                  HistoryExerciseGroup[]
                >((groups, log) => {
                  const key = log.exercise_id.trim().toLocaleLowerCase();
                  const muscleGroup =
                    getExerciseForLog(log)?.primary_muscle_group ??
                    "Body group";
                  let exerciseGroup = groups.find(
                    (group) =>
                      group.exerciseId.trim().toLocaleLowerCase() === key &&
                      group.muscleGroup === muscleGroup,
                  );
                  if (!exerciseGroup) {
                    exerciseGroup = {
                      exerciseId: log.exercise_id,
                      muscleGroup,
                      logs: [],
                    };
                    groups.push(exerciseGroup);
                  }
                  exerciseGroup.logs.push(log);
                  return groups;
                }, []);

                return (
                  <li key={workout.key} className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="font-semibold">
                        Workout {index + 1}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {exercisesInWorkout.length}{" "}
                          {exercisesInWorkout.length === 1 ? "exercise" : "exercises"}
                        </span>
                      </h3>
                      <time
                        className="text-sm text-muted-foreground"
                        dateTime={workout.createdAt}
                      >
                        {new Date(workout.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                    <ul className="space-y-2">
                      {exercisesInWorkout.map((exerciseGroup) => {
                        const sets = [...exerciseGroup.logs].sort(
                          (first, second) =>
                            (first.set ?? 0) - (second.set ?? 0),
                        );
                        const bestSet = sets.reduce<ExerciseLog | null>(
                          (best, log) =>
                            best == null ||
                            (log.weight ?? 0) > (best.weight ?? 0)
                              ? log
                              : best,
                          null,
                        );

                        return (
                          <li key={exerciseGroup.exerciseId}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedHistoryExercise({
                                  ...exerciseGroup,
                                  workoutDate: workout.createdAt,
                                })
                              }
                              className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="font-medium">
                                {exerciseGroup.exerciseId}
                                <span className="ml-2 font-normal text-muted-foreground">
                                  {exerciseGroup.muscleGroup}
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                {sets.length} {sets.length === 1 ? "set" : "sets"}
                                {bestSet &&
                                  ` · Best ${formatLoggedWeight(bestSet.weight)} lbs`}
                                {" · View"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              No workouts logged yet.
            </p>
          )}
      </section>}

      {section === "workout-history" && selectedHistoryExercise && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedHistoryExercise(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-exercise-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-5 text-card-foreground shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="history-exercise-title" className="text-lg font-bold">
                  {selectedHistoryExercise.exerciseId}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedHistoryExercise.muscleGroup} ·{" "}
                  {new Date(selectedHistoryExercise.workoutDate).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setSelectedHistoryExercise(null)}
                className="h-9 shrink-0 rounded-md border px-3 text-sm font-medium hover:bg-accent"
              >
                Close
              </button>
            </div>
            <h3 className="mt-5 text-sm font-semibold">Sets</h3>
            <ul className="mt-2 divide-y rounded-lg border">
              {[...selectedHistoryExercise.logs]
                .sort((first, second) => (first.set ?? 0) - (second.set ?? 0))
                .map((log, index) => (
                  <li
                    key={log.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-3 text-sm"
                  >
                    <span className="font-medium">
                      Set {log.set ?? index + 1}
                    </span>
                    <span className="text-right text-muted-foreground">
                      {formatLoggedWeight(log.weight)} lbs × {log.reps ?? "—"} reps
                    </span>
                    <span className="col-span-2 text-right text-xs font-medium text-primary">
                      Est. 1RM{" "}
                      {formatLoggedWeight(
                        calculateEstimatedOneRepMax(log.weight, log.reps),
                      )}{" "}
                      lbs
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}

      {section === "exercise-goals" && <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Your Exercises &amp; Goals</h2>
          <button
            type="button"
            onClick={() => setIsAddExerciseOpen(true)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add exercise
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading workouts...</p>
        ) : userExercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no exercises yet.
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
              <label className="relative block">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={exerciseSearch}
                  onChange={(event) => setExerciseSearch(event.target.value)}
                  placeholder="Search exercises"
                  aria-label="Search exercises"
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                />
              </label>
              <label className="sr-only" htmlFor="muscle-group-filter">
                Filter by primary muscle group
              </label>
              <select
                id="muscle-group-filter"
                value={muscleGroupFilter}
                onChange={(event) => setMuscleGroupFilter(event.target.value)}
                aria-label="Filter by primary muscle group"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All muscle groups</option>
                {muscleGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            {filteredExercises.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredExercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                goals={exerciseGoals.filter(
                  (goal) => goal.exercise_id === exercise.exercise_id,
                )}
                logs={exerciseLogs.filter(
                  (log) => log.exercise_id === exercise.exercise_id,
                )}
                onAddGoal={addGoal}
                onMarkGoalAchieved={markGoalAchieved}
                onUpdateExerciseType={updateExerciseType}
              />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                No exercises match those filters.
              </p>
            )}
          </>
        )}
      </section>}

      {section === "exercise-goals" && isAddExerciseOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-exercise-title"
            className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-xl"
          >
            <h2 id="add-exercise-title" className="text-xl font-bold">
              Add an exercise
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add an exercise and its primary muscle group to your library.
            </p>
            <form onSubmit={addExercise} className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium">
                Exercise
                <input
                  autoFocus
                  value={exerciseName}
                  onChange={(event) => setExerciseName(event.target.value)}
                  required
                  maxLength={120}
                  className="h-10 rounded-md border border-input bg-background px-3"
                  placeholder="e.g. Bench press"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Primary muscle group
                <select
                  value={primaryMuscleGroup}
                  onChange={(event) => setPrimaryMuscleGroup(event.target.value)}
                  required
                  className="h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="" disabled>Select a body group</option>
                  {BODY_GROUPS.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Exercise type
                <select
                  value={exerciseType}
                  onChange={(event) => setExerciseType(event.target.value)}
                  required
                  className="h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="" disabled>Select exercise type</option>
                  <option value="compound">Compound</option>
                  <option value="isolated">Isolated</option>
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddExerciseOpen(false)}
                  disabled={isAddingExercise}
                  className="h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingExercise}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {isAddingExercise ? "Adding..." : "Add exercise"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {achievement && (
        <GoalAchievementDialog
          key={achievement.goalId}
          achievement={achievement}
          onAddGoal={addGoal}
          onClose={() => setAchievement(null)}
        />
      )}
    </main>
  );
}
