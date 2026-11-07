"use client";

import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  CirclePause,
  CirclePlay,
  Flag,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Lap = {
  id: number;
  elapsedMs: number;
  splitMs: number;
  label: string;
};

type StopwatchSession = {
  elapsedMs: number;
  startedAt: number | null;
  laps: Lap[];
  lastRestElapsedMs: number;
  restRemainingMs: number;
  restStartedAt: number | null;
};

const SESSION_STORAGE_KEY = "workout-stopwatch-session";
const REST_DURATION_STORAGE_KEY = "workout-rest-duration-seconds";
const DEFAULT_REST_SECONDS = 90;
const MIN_REST_SECONDS = 15;
const MAX_REST_SECONDS = 60 * 60;

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStopwatchSession(value: unknown): value is StopwatchSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;

  return (
    isNonNegativeNumber(session.elapsedMs) &&
    (session.startedAt === null || isNonNegativeNumber(session.startedAt)) &&
    Array.isArray(session.laps) &&
    session.laps.every(
      (lap) =>
        typeof lap === "object" &&
        lap !== null &&
        isNonNegativeNumber(lap.id) &&
        isNonNegativeNumber(lap.elapsedMs) &&
        isNonNegativeNumber(lap.splitMs) &&
        typeof lap.label === "string",
    ) &&
    isNonNegativeNumber(session.lastRestElapsedMs) &&
    isNonNegativeNumber(session.restRemainingMs) &&
    (session.restStartedAt === null ||
      isNonNegativeNumber(session.restStartedAt))
  );
}

function formatStopwatchTime(milliseconds: number, includeHours = false) {
  const totalCentiseconds = Math.floor(milliseconds / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;

  return includeHours || hours > 0
    ? `${String(hours).padStart(2, "0")}:${base}`
    : base;
}

function formatRestTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function WorkoutStopwatch({
  lapLabel,
  userId,
}: {
  lapLabel: string | null;
  userId: string;
}) {
  const [now, setNow] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [lastRestElapsedMs, setLastRestElapsedMs] = useState(0);
  const [restRemainingMs, setRestRemainingMs] = useState(0);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [restDurationSeconds, setRestDurationSeconds] =
    useState(DEFAULT_REST_SECONDS);
  const [restDurationLoaded, setRestDurationLoaded] = useState(false);
  const [restDurationStorageError, setRestDurationStorageError] =
    useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(false);
  const notifiedRestStartRef = useRef<number | null>(null);

  async function notifyRestComplete(): Promise<string | null> {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification("Rest complete", {
            body: "Your break is over. Ready for the next set?",
            icon: "/opengraph-image.png",
            tag: "workout-rest-complete",
          });
          return null;
        }
      }

      new Notification("Rest complete", {
        body: "Your break is over. Ready for the next set?",
        icon: "/opengraph-image.png",
        tag: "workout-rest-complete",
      });
      return null;
    } catch (error) {
      return error instanceof Error
        ? `Could not show browser notification: ${error.message}`
        : "Could not show browser notification.";
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const savedDuration = window.localStorage.getItem(
          REST_DURATION_STORAGE_KEY,
        );
        if (savedDuration !== null) {
          const parsedDuration = Number(savedDuration);
          if (
            !Number.isInteger(parsedDuration) ||
            parsedDuration < MIN_REST_SECONDS ||
            parsedDuration > MAX_REST_SECONDS
          ) {
            throw new Error("Saved rest duration is outside the supported range.");
          }
          setRestDurationSeconds(parsedDuration);
        }
      } catch (error) {
        console.error("Could not restore the workout rest duration.", error);
        setRestDurationStorageError(true);
      } finally {
        setRestDurationLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function changeRestDuration(value: string) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60) return;
    const seconds = Math.round(minutes * 60);
    if (seconds < MIN_REST_SECONDS || seconds > MAX_REST_SECONDS) return;

    setRestDurationSeconds(seconds);
    try {
      window.localStorage.setItem(
        REST_DURATION_STORAGE_KEY,
        String(seconds),
      );
      setRestDurationStorageError(false);
    } catch (error) {
      console.error("Could not save the workout rest duration.", error);
      setRestDurationStorageError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function restorePushAlertState() {
      try {
        const supabase = createClient();
        const { data, error: alertTableError } = await supabase
          .from("workout_rest_alerts")
          .select("enabled")
          .eq("userprofile", userId)
          .maybeSingle();
        if (alertTableError) {
          throw new Error(
            "Apply the workout rest alerts SQL setup before enabling lock-screen alerts.",
          );
        }

        if (!cancelled) {
          setPushAlertsEnabled(data?.enabled === true);
        }
      } catch (error) {
        console.error("Could not restore workout rest alert setup.", error);
        if (!cancelled) {
          setNotificationError(
            error instanceof Error
              ? error.message
              : "Could not verify lock-screen alert setup.",
          );
        }
      }
    }

    void restorePushAlertState();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const savedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSession) {
          const parsedSession: unknown = JSON.parse(savedSession);
          if (!isStopwatchSession(parsedSession)) {
            throw new Error("Saved stopwatch session has an invalid format.");
          }

          setElapsedMs(parsedSession.elapsedMs);
          setStartedAt(parsedSession.startedAt);
          setLaps(parsedSession.laps);
          setLastRestElapsedMs(parsedSession.lastRestElapsedMs);
          setRestRemainingMs(parsedSession.restRemainingMs);
          setRestStartedAt(parsedSession.restStartedAt);
        }
      } catch (error) {
        console.error("Could not restore the workout stopwatch session.", error);
        setStorageError(true);
      } finally {
        setSessionLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!sessionLoaded) return;

    const session: StopwatchSession = {
      elapsedMs,
      startedAt,
      laps,
      lastRestElapsedMs,
      restRemainingMs,
      restStartedAt,
    };

    let saveFailed = false;
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error("Could not save the workout stopwatch session.", error);
      saveFailed = true;
    }

    const timeout = window.setTimeout(() => setStorageError(saveFailed), 0);
    return () => window.clearTimeout(timeout);
  }, [
    elapsedMs,
    laps,
    lastRestElapsedMs,
    restRemainingMs,
    restStartedAt,
    sessionLoaded,
    startedAt,
  ]);

  const stopwatchRunning = startedAt !== null;
  const currentElapsedMs =
    elapsedMs +
    (stopwatchRunning && now > 0 && startedAt !== null
      ? Math.max(0, now - startedAt)
      : 0);
  const restMsForDisplay =
    restRemainingMs === 0 && restStartedAt === null
      ? restDurationSeconds * 1000
      : restRemainingMs;
  const restSeconds = Math.max(
    0,
    Math.ceil(
      (restMsForDisplay -
        (restStartedAt !== null && now > 0
          ? Math.max(0, now - restStartedAt)
          : 0)) /
        1000,
    ),
  );
  const restRunning = restStartedAt !== null && restSeconds > 0;
  const restComplete = restStartedAt !== null && restSeconds === 0;
  const isRestInProgress =
    restSeconds > 0 && (restStartedAt !== null || restRemainingMs > 0);
  const elapsedSinceRestMs = isRestInProgress
    ? 0
    : Math.max(0, currentElapsedMs - lastRestElapsedMs);
  const secondHandRotation = (currentElapsedMs / 1000) * 6;
  const minuteHandRotation = (currentElapsedMs / 60_000) * 6;
  const hourHandRotation = (currentElapsedMs / 120_000) % 360;

  useEffect(() => {
    if (!restComplete || restStartedAt === null) return;

    const timeout = window.setTimeout(() => {
      setLastRestElapsedMs(
        elapsedMs +
          (startedAt === null
            ? 0
            : Math.max(0, Date.now() - startedAt)),
      );
    }, 0);

    if (notifiedRestStartRef.current !== restStartedAt) {
      notifiedRestStartRef.current = restStartedAt;
      if (
        document.visibilityState === "visible" &&
        "Notification" in window &&
        window.Notification.permission === "granted"
      ) {
        void notifyRestComplete().then((error) => {
          if (error) setNotificationError(error);
        });
      }
    }

    return () => window.clearTimeout(timeout);
  }, [elapsedMs, restComplete, restStartedAt, startedAt]);

  async function scheduleRestAlert(endsAt: number) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("workout_rest_alerts").upsert(
        {
          userprofile: userId,
          next_at: new Date(endsAt).toISOString(),
          claimed_at: null,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "userprofile" },
      );
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Could not schedule the workout rest push alert.", error);
      setNotificationError(
        "Could not schedule the lock-screen alert. Apply the workout rest alerts SQL setup and try again.",
      );
      return false;
    }
  }

  async function cancelRestAlert() {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_rest_alerts")
        .update({
          next_at: null,
          claimed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("userprofile", userId);
      if (error) throw error;
    } catch (error) {
      console.error("Could not cancel the workout rest push alert.", error);
      setNotificationError("Could not cancel the scheduled phone alert.");
    }
  }

  function startStopwatch() {
    setStartedAt(Date.now());
  }

  function pauseStopwatch() {
    if (startedAt === null) return;
    setElapsedMs((current) => current + Math.max(0, Date.now() - startedAt));
    setStartedAt(null);
  }

  function resetStopwatch() {
    setStartedAt(null);
    setElapsedMs(0);
    setLaps([]);
    setLastRestElapsedMs(0);
  }

  function recordLap() {
    const label = lapLabel || `Lap ${laps.length + 1}`;
    setLaps((current) => [
      {
        id: Date.now(),
        elapsedMs: currentElapsedMs,
        splitMs: currentElapsedMs - (current[0]?.elapsedMs ?? 0),
        label,
      },
      ...current,
    ]);
  }

  function startRest() {
    setNotificationError(null);
    setLastRestElapsedMs(currentElapsedMs);
    const remaining =
      restRemainingMs > 0 && !restComplete
        ? restRemainingMs
        : restDurationSeconds * 1000;
    const startedAt = Date.now();
    setRestRemainingMs(remaining);
    setRestStartedAt(startedAt);
    if (pushAlertsEnabled) void scheduleRestAlert(startedAt + remaining);
  }

  function pauseRest() {
    if (restStartedAt === null) return;
    const remaining = Math.max(
      0,
      restRemainingMs -
        Math.max(0, Date.now() - restStartedAt),
    );
    setRestRemainingMs(remaining);
    setRestStartedAt(null);
    void cancelRestAlert();
  }

  function resetRest() {
    setRestStartedAt(null);
    setRestRemainingMs(0);
    void cancelRestAlert();
  }

  const marks = Array.from({ length: 60 }, (_, index) => {
    const angle = (index * 6 * Math.PI) / 180;
    const isMajor = index % 5 === 0;
    const innerRadius = isMajor ? 44 : 47;
    const outerRadius = 52;
    const roundCoordinate = (value: number) => Number(value.toFixed(3));
    return {
      key: index,
      x1: roundCoordinate(60 + Math.sin(angle) * innerRadius),
      y1: roundCoordinate(60 - Math.cos(angle) * innerRadius),
      x2: roundCoordinate(60 + Math.sin(angle) * outerRadius),
      y2: roundCoordinate(60 - Math.cos(angle) * outerRadius),
      isMajor,
    };
  });
  const numerals = Array.from({ length: 12 }, (_, index) => {
    const number = index === 0 ? 12 : index;
    const angle = (index * 30 * Math.PI) / 180;
    return {
      number,
      x: Number((60 + Math.sin(angle) * 36).toFixed(3)),
      y: Number((60 - Math.cos(angle) * 36 + 1.8).toFixed(3)),
    };
  });

  return (
    <section
      aria-label="Workout stopwatch and rest timer"
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-cyan-500/[0.06] p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-cyan-500/10 blur-3xl"
      />
      {storageError && (
        <p
          role="alert"
          className="relative mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          Timer data could not be saved for this app session. Check that browser
          storage is available.
        </p>
      )}
      <div className="relative mt-1 grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(13rem,0.85fr)] md:items-stretch md:gap-5">
        <div className="grid min-w-0 gap-3 rounded-2xl border bg-background/50 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div className="flex min-w-0 items-center justify-center gap-3 sm:justify-start sm:gap-4">
          <div className="relative flex size-36 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 via-sky-500 to-blue-700 p-[3px] shadow-[0_0_32px_-8px_rgba(14,165,233,0.65)] sm:size-48">
            <div className="absolute inset-1 rounded-full border border-white/40" />
            <div className="absolute inset-2 rounded-full bg-card shadow-inner" />
            <svg
              viewBox="0 0 120 120"
              className="absolute inset-2 size-32 sm:size-44"
              aria-hidden="true"
            >
              <circle
                cx="60"
                cy="60"
                r="56"
                className="fill-none stroke-cyan-500/20 dark:stroke-cyan-200/15"
                strokeWidth="2"
              />
              <circle
                cx="60"
                cy="60"
                r="56"
                className="fill-none stroke-cyan-500/80 dark:stroke-cyan-200/80"
                strokeWidth="1.5"
                strokeDasharray={`${(currentElapsedMs % 60_000) / 60_000 * 351.86} 351.86`}
                transform="rotate(-90 60 60)"
              />
              {marks.map((mark) => (
                <line
                  key={mark.key}
                  x1={mark.x1}
                  y1={mark.y1}
                  x2={mark.x2}
                  y2={mark.y2}
                  className={
                    mark.isMajor ? "stroke-foreground/60" : "stroke-muted-foreground/30"
                  }
                  strokeWidth={mark.isMajor ? "1.5" : "0.75"}
                  strokeLinecap="round"
                />
              ))}
              {numerals.map((numeral) => (
                <text
                  key={numeral.number}
                  x={numeral.x}
                  y={numeral.y}
                  textAnchor="middle"
                  className="fill-foreground/80 text-[6px] font-semibold"
                >
                  {numeral.number}
                </text>
              ))}
              <g transform={`rotate(${hourHandRotation} 60 60)`}>
                <line
                  x1="60"
                  y1="62"
                  x2="60"
                  y2="43"
                  className="stroke-foreground"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>
              <g transform={`rotate(${minuteHandRotation} 60 60)`}>
                <line
                  x1="60"
                  y1="62"
                  x2="60"
                  y2="31"
                  className="stroke-foreground/90"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
              <g transform={`rotate(${secondHandRotation} 60 60)`}>
                <line
                  x1="60"
                  y1="70"
                  x2="60"
                  y2="21"
                  className="stroke-sky-600 dark:stroke-sky-300"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
                <circle
                  cx="60"
                  cy="22"
                  r="1.75"
                  className="fill-sky-600 dark:fill-sky-300"
                />
              </g>
              <circle
                cx="60"
                cy="60"
                r="3.5"
                className="fill-sky-600 stroke-card dark:fill-sky-300"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Workout time
              </p>
              <p
                role="timer"
                aria-label={`Total workout time: ${formatStopwatchTime(currentElapsedMs, true)}`}
                className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl"
              >
                {formatStopwatchTime(currentElapsedMs, true)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stopwatchRunning ? "Workout in progress" : currentElapsedMs > 0 ? "Paused" : "Ready when you are"}
              </p>
          </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-col">
              <button
                type="button"
                onClick={stopwatchRunning ? pauseStopwatch : startStopwatch}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 sm:h-11 sm:gap-2 sm:px-4 sm:text-sm"
              >
                {stopwatchRunning ? (
                  <>
                    <CirclePause aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <CirclePlay aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
                    {currentElapsedMs > 0 ? "Resume" : "Start"}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={recordLap}
                disabled={!stopwatchRunning}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl border bg-background px-1.5 text-[11px] font-semibold transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Flag aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
                Log set
              </button>
              <button
                type="button"
                onClick={resetStopwatch}
                aria-label="Reset workout timer and laps"
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl border bg-background px-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground sm:h-11 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <RotateCcw aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
                <span>Reset</span>
              </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-orange-500/20 bg-orange-500/[0.05] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">
                Rest timer
              </p>
              <label
                htmlFor="rest-duration-minutes"
                className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
              >
                Duration
                <input
                  id="rest-duration-minutes"
                  type="number"
                  min={MIN_REST_SECONDS / 60}
                  max={MAX_REST_SECONDS / 60}
                  step="0.25"
                  value={Number((restDurationSeconds / 60).toFixed(2))}
                  disabled={!restDurationLoaded || restRunning}
                  onChange={(event) =>
                    changeRestDuration(event.currentTarget.value)
                  }
                  className="h-8 w-20 rounded-md border bg-background px-2 text-center text-sm font-semibold text-foreground tabular-nums disabled:opacity-60"
                  aria-describedby="rest-duration-help"
                />
                min
              </label>
            </div>
            <div className="text-right">
              <span
                role="timer"
                aria-label={`Rest timer ${formatRestTime(restSeconds)}`}
                className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl"
              >
                {formatRestTime(restSeconds)}
              </span>
            </div>
          </div>
          <p id="rest-duration-help" className="mt-1 text-[10px] text-muted-foreground">
            Set 0.25–60 minutes. Your choice is saved on this device.
          </p>
          {restDurationStorageError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              Could not save the rest duration in this browser.
            </p>
          )}
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            {restRunning ? (
              <button
                type="button"
                onClick={pauseRest}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border bg-background px-2 text-xs font-semibold hover:bg-accent sm:px-3 sm:text-sm"
              >
                <CirclePause aria-hidden="true" className="size-3.5" />
                Pause rest
              </button>
            ) : (
              <button
                type="button"
                onClick={startRest}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-orange-500 px-2 text-xs font-semibold text-white transition hover:bg-orange-600 sm:px-3 sm:text-sm"
              >
                <CirclePlay aria-hidden="true" className="size-3.5" />
                {restComplete ? "Restart rest" : restRemainingMs > 0 ? "Resume rest" : "Start rest"}
              </button>
            )}
            <button
              type="button"
              onClick={resetRest}
              aria-label="Reset rest timer"
              className="inline-flex size-10 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:bg-accent"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          {notificationError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {notificationError}
            </p>
          )}
          {restComplete && (
            <div
              role="status"
              aria-live="polite"
              className="mt-3 flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-800 dark:text-orange-200"
            >
              <BellRing aria-hidden="true" className="size-4 shrink-0" />
              <p>
                <span className="font-bold">Rest complete!</span> Ready for the
                next set.
              </p>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-200">
                Time since last rest
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isRestInProgress ? "Paused during rest" : "Time since your last break"}
              </p>
            </div>
            <p className="text-base font-bold tabular-nums">
              {formatStopwatchTime(elapsedSinceRestMs, true)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-5 border-t pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Set log</h3>
            <p className="text-xs text-muted-foreground">Tap “Log set” after each set to record your time.</p>
          </div>
        </div>
        {laps.length ? (
          <ol className="grid max-h-36 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {laps.map((lap, index) => (
              <li
                key={lap.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate">
                  <span className="mr-2 font-bold text-cyan-700 dark:text-cyan-300">
                    {laps.length - index}
                  </span>
                  <span className="font-medium">{lap.label}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="font-semibold">
                    {formatStopwatchTime(lap.elapsedMs, true)}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    +{formatStopwatchTime(lap.splitMs)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            Your logged sets will appear here.
          </p>
        )}
      </div>
    </section>
  );
}
