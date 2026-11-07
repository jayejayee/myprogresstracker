"use client";

import { useEffect, useState } from "react";
import { CirclePause, CirclePlay, Flag, RotateCcw } from "lucide-react";

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
const DEFAULT_REST_SECONDS = 90;

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

export function WorkoutStopwatch({ lapLabel }: { lapLabel: string | null }) {
  const [now, setNow] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [lastRestElapsedMs, setLastRestElapsedMs] = useState(0);
  const [restRemainingMs, setRestRemainingMs] = useState(0);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(interval);
  }, []);

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
      ? DEFAULT_REST_SECONDS * 1000
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
    if (!restComplete) return;

    const timeout = window.setTimeout(() => {
      setLastRestElapsedMs(
        elapsedMs +
          (startedAt === null
            ? 0
            : Math.max(0, Date.now() - startedAt)),
      );
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [elapsedMs, restComplete, startedAt]);

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
    setLastRestElapsedMs(currentElapsedMs);
    setRestRemainingMs((remaining) =>
      remaining > 0 ? remaining : DEFAULT_REST_SECONDS * 1000,
    );
    setRestStartedAt(Date.now());
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
  }

  function resetRest() {
    setRestStartedAt(null);
    setRestRemainingMs(0);
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
      <div className="relative mt-1 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.8fr)] md:items-center">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center md:justify-start">
          <div className="flex flex-col items-center gap-2">
          <div className="relative flex size-48 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 via-sky-500 to-blue-700 p-[3px] shadow-[0_0_32px_-8px_rgba(14,165,233,0.65)]">
            <div className="absolute inset-1 rounded-full border border-white/40" />
            <div className="absolute inset-2 rounded-full bg-card shadow-inner" />
            <svg
              viewBox="0 0 120 120"
              className="absolute inset-2 size-44"
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
          <div className="flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 shadow-sm">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Elapsed
            </span>
            <span
              role="timer"
              aria-label={`Total time since start: ${formatStopwatchTime(currentElapsedMs, true)}`}
              className="text-sm font-bold tabular-nums tracking-tight"
            >
              {formatStopwatchTime(currentElapsedMs, true)}
            </span>
          </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-col">
            <button
              type="button"
              onClick={stopwatchRunning ? pauseStopwatch : startStopwatch}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 sm:flex-none"
            >
              {stopwatchRunning ? (
                <>
                  <CirclePause aria-hidden="true" className="size-4" />
                  Pause
                </>
              ) : (
                <>
                  <CirclePlay aria-hidden="true" className="size-4" />
                  {currentElapsedMs > 0 ? "Resume" : "Start"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resetStopwatch}
              aria-label="Reset stopwatch and laps"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.04] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700 dark:text-orange-300">
                REST
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                90-second recovery timer
              </p>
            </div>
            <span
              role="timer"
              aria-label={`Rest timer ${formatRestTime(restSeconds)}`}
              className="text-2xl font-bold tabular-nums tracking-tight"
            >
              {formatRestTime(restSeconds)}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {restRunning ? (
              <button
                type="button"
                onClick={pauseRest}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-semibold hover:bg-accent"
              >
                <CirclePause aria-hidden="true" className="size-3.5" />
                Pause rest
              </button>
            ) : (
              <button
                type="button"
                onClick={startRest}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 text-xs font-semibold text-white transition hover:bg-orange-600"
              >
                <CirclePlay aria-hidden="true" className="size-3.5" />
                {restComplete ? "Restart rest" : "Start 90s rest"}
              </button>
            )}
            <button
              type="button"
              onClick={resetRest}
              aria-label="Reset rest timer"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:bg-accent"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          {restComplete && (
            <p role="status" className="mt-2 text-xs font-semibold text-orange-700 dark:text-orange-300">
              Rest complete—ready for the next set.
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Elapsed since start
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">
            {formatStopwatchTime(currentElapsedMs, true)}
          </p>
        </div>
        <div className="rounded-xl bg-cyan-500/[0.08] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-200">
            Since last rest
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">
            {formatStopwatchTime(elapsedSinceRestMs, true)}
          </p>
        </div>
      </div>

      <div className="relative mt-5 border-t pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Lap &amp; set log</h3>
          <button
            type="button"
            onClick={recordLap}
            disabled={!stopwatchRunning}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Flag aria-hidden="true" className="size-3.5" />
            Lap / log set
          </button>
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
            Start the stopwatch, then log a lap for each set. Laps are kept for
            this session.
          </p>
        )}
      </div>
    </section>
  );
}
