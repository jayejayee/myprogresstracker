"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Award, Target, X } from "lucide-react";
import { DottedProgress } from "@/components/dotted-progress";

type AchievedGoal = {
  id: number;
  exercise_id: string;
  "1rm": number | null;
  created_at: string;
};

type ExerciseGoalsCardProps = {
  achievedGoals: AchievedGoal[];
  activeGoalCount: number;
  totalGoalCount: number;
};

export function ExerciseGoalsCard({
  achievedGoals,
  activeGoalCount,
  totalGoalCount,
}: ExerciseGoalsCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-card via-card to-emerald-500/10 p-5 text-left text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Exercise goals</h2>
          <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Target aria-hidden="true" className="size-4" />
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-4xl font-bold tracking-tight">
              {achievedGoals.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {achievedGoals.length === 1 ? "goal achieved" : "goals achieved"}
            </p>
          </div>
          <DottedProgress
            progress={
              totalGoalCount
                ? Math.round((achievedGoals.length / totalGoalCount) * 100)
                : 0
            }
            size="compact"
            dotCount={20}
          />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-emerald-500/10 pt-3 text-sm text-muted-foreground">
          <span>
            {activeGoalCount} active {activeGoalCount === 1 ? "goal" : "goals"}
          </span>
          <span>
            {achievedGoals.length ? "View achievements" : "View goals"}
          </span>
        </div>
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="recent-goal-achievements-title"
              className="w-full max-w-md rounded-xl border bg-card p-5 text-card-foreground shadow-xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="recent-goal-achievements-title"
                    className="text-lg font-semibold"
                  >
                    Recent goal achievements
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your latest exercise milestones.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close achievements"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
              {achievedGoals.length ? (
                <ul className="max-h-[60vh] divide-y overflow-y-auto">
                  {achievedGoals.slice(0, 10).map((goal) => (
                    <li
                      key={goal.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Award aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {goal.exercise_id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(goal.created_at).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold">
                        {goal["1rm"] ?? "—"} lbs
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  Your first achieved goal will show up here.
                </p>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
