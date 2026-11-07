"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CirclePause,
  CirclePlay,
  RotateCcw,
  Timer,
} from "lucide-react";

type FocusTask = {
  id: number;
  title: string;
};

type TimerMode = "focus" | "break";

type TimerState = {
  mode: TimerMode;
  remainingSeconds: number;
  endsAt: number | null;
  taskId: string;
  completedSessions: number;
  focusMinutes: number;
  breakMinutes: number;
};

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const MIN_FOCUS_MINUTES = 1;
const MAX_FOCUS_MINUTES = 180;
const MIN_BREAK_MINUTES = 1;
const MAX_BREAK_MINUTES = 60;

function getDurationSeconds(state: TimerState, mode: TimerMode = state.mode) {
  return (mode === "focus" ? state.focusMinutes : state.breakMinutes) * 60;
}

function createInitialState(): TimerState {
  return {
    mode: "focus",
    remainingSeconds: DEFAULT_FOCUS_MINUTES * 60,
    endsAt: null,
    taskId: "",
    completedSessions: 0,
    focusMinutes: DEFAULT_FOCUS_MINUTES,
    breakMinutes: DEFAULT_BREAK_MINUTES,
  };
}

function isValidMinutes(value: unknown, min: number, max: number) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<TimerState>;
  return (
    (state.mode === "focus" || state.mode === "break") &&
    typeof state.remainingSeconds === "number" &&
    Number.isFinite(state.remainingSeconds) &&
    state.remainingSeconds >= 0 &&
    (state.endsAt === null ||
      (typeof state.endsAt === "number" && Number.isFinite(state.endsAt))) &&
    typeof state.taskId === "string" &&
    typeof state.completedSessions === "number" &&
    Number.isInteger(state.completedSessions) &&
    state.completedSessions >= 0 &&
    (state.focusMinutes === undefined ||
      isValidMinutes(state.focusMinutes, MIN_FOCUS_MINUTES, MAX_FOCUS_MINUTES)) &&
    (state.breakMinutes === undefined ||
      isValidMinutes(state.breakMinutes, MIN_BREAK_MINUTES, MAX_BREAK_MINUTES))
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function FocusTimer({
  userId,
  tasks,
}: {
  userId: string;
  tasks: FocusTask[];
}) {
  const storageKey = `focus-timer-${userId}`;
  const [timer, setTimer] = useState(createInitialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const notifiedEndRef = useRef<number | null>(null);

  async function notifyTimerCompletion(title: string, body: string) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(title, {
            body,
            icon: "/opengraph-image.png",
            tag: "focus-timer-complete",
          });
          return;
        }
      }

      new Notification(title, { body, icon: "/opengraph-image.png" });
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? `Could not show browser notification: ${error.message}`
          : "Could not show browser notification.",
      );
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setNotificationPermission(
        "Notification" in window
          ? window.Notification.permission
          : "unsupported",
      );
      const savedState = window.localStorage.getItem(storageKey);
      if (savedState) {
        try {
          const parsed: unknown = JSON.parse(savedState);
          if (isTimerState(parsed)) {
            const restored = {
              ...createInitialState(),
              ...parsed,
            };
            if (restored.endsAt !== null) {
              const remainingSeconds = Math.ceil(
                (restored.endsAt - Date.now()) / 1000,
              );
              if (remainingSeconds <= 0) {
                const nextMode = restored.mode === "focus" ? "break" : "focus";
                setCompletionMessage(
                  restored.mode === "focus"
                    ? "Focus session complete—time for a break."
                    : "Break complete—ready to focus again?",
                );
                setTimer({
                  ...restored,
                  mode: nextMode,
                  remainingSeconds: getDurationSeconds(restored, nextMode),
                  endsAt: null,
                  completedSessions:
                    restored.completedSessions +
                    (restored.mode === "focus" ? 1 : 0),
                });
              } else {
                setTimer({ ...restored, remainingSeconds });
              }
            } else {
              setTimer(restored);
            }
          } else {
            window.localStorage.removeItem(storageKey);
          }
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(timer));
  }, [isHydrated, storageKey, timer]);

  useEffect(() => {
    const endsAt = timer.endsAt;
    if (endsAt === null) return;

    const interval = window.setInterval(() => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((endsAt - Date.now()) / 1000),
      );
      if (remainingSeconds > 0) {
        setTimer((current) =>
          current.remainingSeconds === remainingSeconds
            ? current
            : { ...current, remainingSeconds },
        );
        return;
      }

      if (notifiedEndRef.current === endsAt) return;
      notifiedEndRef.current = endsAt;
      const completedMode = timer.mode;
      const title =
        completedMode === "focus" ? "Focus session complete" : "Break is over";
      const body =
        completedMode === "focus"
          ? "Great work. Your focus timer is done."
          : "Your break timer is done. Ready to focus again?";
      setCompletionMessage(
        completedMode === "focus"
          ? "Focus session complete—time for a break."
          : "Break complete—ready to focus again?",
      );
      setNotificationError(null);
      void notifyTimerCompletion(title, body);

      setTimer((current) => {
        if (current.endsAt === null) return current;
        const nextMode = current.mode === "focus" ? "break" : "focus";
        return {
          ...current,
          mode: nextMode,
          remainingSeconds: getDurationSeconds(current, nextMode),
          endsAt: null,
          completedSessions:
            current.completedSessions + (current.mode === "focus" ? 1 : 0),
        };
      });
    }, 250);

    return () => window.clearInterval(interval);
  }, [timer.endsAt, timer.mode]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      setNotificationError(
        permission === "denied"
          ? "Notifications are blocked in your browser settings."
          : null,
      );
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? `Could not enable notifications: ${error.message}`
          : "Could not enable notifications.",
      );
    }
  }

  function startTimer() {
    setTimer((current) => ({
      ...current,
      endsAt: Date.now() + current.remainingSeconds * 1000,
    }));
  }

  function pauseTimer() {
    setTimer((current) => ({
      ...current,
      remainingSeconds:
        current.endsAt === null
          ? current.remainingSeconds
          : Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)),
      endsAt: null,
    }));
  }

  function resetTimer() {
    setTimer((current) => ({
      ...current,
      remainingSeconds: getDurationSeconds(current),
      endsAt: null,
    }));
  }

  function selectMode(mode: TimerMode) {
    setTimer((current) => ({
      ...current,
      mode,
      remainingSeconds: getDurationSeconds(current, mode),
      endsAt: null,
    }));
  }

  function updateDuration(mode: TimerMode, value: string) {
    const minutes = Number(value);
    const min = mode === "focus" ? MIN_FOCUS_MINUTES : MIN_BREAK_MINUTES;
    const max = mode === "focus" ? MAX_FOCUS_MINUTES : MAX_BREAK_MINUTES;
    if (!isValidMinutes(minutes, min, max)) return;

    setTimer((current) => ({
      ...current,
      [mode === "focus" ? "focusMinutes" : "breakMinutes"]: minutes,
      ...(current.mode === mode && current.endsAt === null
        ? { remainingSeconds: minutes * 60 }
        : {}),
    }));
  }

  const duration = getDurationSeconds(timer);
  const configuredDuration =
    timer.mode === "focus" ? timer.focusMinutes : timer.breakMinutes;
  const progress =
    ((duration - timer.remainingSeconds) / duration) * 100;
  const selectedTask = tasks.find((task) => String(task.id) === timer.taskId);
  const isWorkoutSelected = timer.taskId === "workout";
  const isRunning = timer.endsAt !== null;

  return (
    <section
      aria-label="Focus timer"
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-violet-500/[0.07] p-5 text-card-foreground shadow-sm sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-20 size-48 rounded-full bg-violet-500/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            <Timer aria-hidden="true" className="size-4" />
            FOCUS MODE
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {timer.mode === "focus" ? "One thing at a time" : "Take a breather"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {timer.mode === "focus"
              ? `A focused ${timer.focusMinutes} minutes, then a short reset.`
              : `Your focus session is complete. Enjoy a ${timer.breakMinutes}-minute break.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {timer.completedSessions}{" "}
            {timer.completedSessions === 1 ? "session" : "sessions"} completed
          </span>
          <button
            type="button"
            onClick={enableNotifications}
            disabled={
              notificationPermission === "granted" ||
              notificationPermission === "unsupported"
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-background/70 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:cursor-default disabled:opacity-70"
          >
            {notificationPermission === "granted" ? (
              <BellRing aria-hidden="true" className="size-3.5 text-emerald-600" />
            ) : (
              <Bell aria-hidden="true" className="size-3.5" />
            )}
            {notificationPermission === "granted"
              ? "Alerts on"
              : notificationPermission === "unsupported"
                ? "Alerts unavailable"
                : "Enable alerts"}
          </button>
        </div>
      </div>

      <div
        className="relative mt-4 inline-flex rounded-xl bg-muted/70 p-1"
        aria-label="Timer mode"
      >
        {(["focus", "break"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={timer.mode === mode}
            disabled={isRunning}
            onClick={() => selectMode(mode)}
            className={`min-w-24 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              timer.mode === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="relative mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex items-center gap-4">
          <div
            role="timer"
            aria-label={`${timer.mode === "focus" ? "Focus" : "Break"} timer: ${formatTime(timer.remainingSeconds)}`}
            className="relative flex size-28 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--primary) ${progress}%, hsl(var(--muted)) ${progress}% 100%)`,
            }}
          >
            <div className="flex size-[6.25rem] items-center justify-center rounded-full bg-card text-2xl font-bold tabular-nums tracking-tight">
              {formatTime(timer.remainingSeconds)}
            </div>
          </div>
          <div className="grid min-w-0 flex-1 gap-2">
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Focus on
              <select
                value={timer.taskId}
                onChange={(event) =>
                  setTimer((current) => ({
                    ...current,
                    taskId: event.target.value,
                  }))
                }
                className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground"
              >
                <option value="workout">Workout</option>
                <option value="">No focus (optional)</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            {(selectedTask || isWorkoutSelected) && (
              <p className="truncate text-xs text-muted-foreground">
                Current focus:{" "}
                <span className="font-medium text-foreground">
                  {isWorkoutSelected ? "Workout" : selectedTask?.title}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:justify-items-end">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground">
              Focus · min
              <input
                type="number"
                min={MIN_FOCUS_MINUTES}
                max={MAX_FOCUS_MINUTES}
                step="1"
                value={timer.focusMinutes}
                disabled={isRunning}
                onChange={(event) => updateDuration("focus", event.target.value)}
                aria-label="Focus duration in minutes"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground disabled:opacity-60"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground">
              Break · min
              <input
                type="number"
                min={MIN_BREAK_MINUTES}
                max={MAX_BREAK_MINUTES}
                step="1"
                value={timer.breakMinutes}
                disabled={isRunning}
                onChange={(event) => updateDuration("break", event.target.value)}
                aria-label="Break duration in minutes"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground disabled:opacity-60"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={pauseTimer}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold transition hover:bg-accent sm:flex-none"
            >
              <CirclePause aria-hidden="true" className="size-4" />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={startTimer}
              disabled={!isHydrated}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50 sm:flex-none"
            >
              <CirclePlay aria-hidden="true" className="size-4" />
              {timer.remainingSeconds !== configuredDuration * 60
                ? "Resume"
                : timer.mode === "focus"
                  ? "Start focus"
                  : "Start break"}
            </button>
          )}
          <button
            type="button"
            onClick={resetTimer}
            aria-label="Reset timer"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
          </button>
          </div>
        </div>
      </div>

      {timer.completedSessions > 0 && (
        <p className="relative mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Check aria-hidden="true" className="size-3.5" />
          Nice work—your completed focus sessions are saved on this device.
        </p>
      )}
      {completionMessage && (
        <p
          role="status"
          className="relative mt-3 rounded-xl bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-800 dark:text-violet-200"
        >
          {completionMessage}
        </p>
      )}
      {notificationError && (
        <p role="status" className="relative mt-2 text-xs text-muted-foreground">
          {notificationError}
        </p>
      )}
    </section>
  );
}
