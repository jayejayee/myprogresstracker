"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Dumbbell, FolderKanban, History, House, ListTodo, Target, Timer, UserRound } from "lucide-react";

const mainNavigationItems = [
  { href: "/protected/home", label: "Home", icon: House },
  { href: "/protected", label: "Tasks", icon: ListTodo },
  { href: "/protected/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/protected/profile", label: "Profile", icon: UserRound },
];

export function AppBottomNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inTasks = pathname === "/protected";
  const inWorkouts = pathname.startsWith("/protected/workouts");
  const taskView = searchParams.get("view") === "tasks" ? "tasks" : "projects";

  const navigationItems = inTasks
    ? [
        { href: "/protected/home", label: "Main menu", icon: ArrowLeft },
        { href: "/protected?view=projects", label: "Projects", icon: FolderKanban },
        { href: "/protected?view=tasks", label: "Tasks", icon: ListTodo },
      ]
    : inWorkouts
      ? [
          { href: "/protected/home", label: "Main menu", icon: ArrowLeft },
          { href: "/protected/workouts/stopwatch", label: "Stopwatch", icon: Timer },
          { href: "/protected/workouts", label: "Log workout", icon: Dumbbell },
          { href: "/protected/workouts/history", label: "History", icon: History },
          { href: "/protected/workouts/exercises", label: "Exercises", icon: Target },
        ]
      : mainNavigationItems;

  return (
    <nav
      aria-label={inTasks ? "Task navigation" : inWorkouts ? "Workout navigation" : "Main navigation"}
      className="fixed inset-x-0 bottom-0 z-50 bg-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
    >
      <div className="mx-auto max-w-xl rounded-2xl border bg-background/95 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className={`grid min-w-0 ${
          navigationItems.length === 3
            ? "grid-cols-3"
            : navigationItems.length === 5
              ? "grid-cols-5"
              : "grid-cols-4"
        } gap-1`}>
          {navigationItems.map(({ href, label, icon: Icon }) => {
            const isActive = inTasks
              ? (label === "Projects" && taskView === "projects") ||
                (label === "Tasks" && taskView === "tasks")
              : inWorkouts
                ? (href === "/protected/workouts"
                    ? pathname === href
                    : pathname === href || pathname.startsWith(`${href}/`))
                : href === "/protected"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-12 min-w-0 flex-row items-center justify-center gap-1.5 overflow-hidden rounded-xl px-1 text-[10px] font-semibold leading-tight transition-colors sm:gap-2 sm:px-2 sm:text-xs ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="hidden min-w-0 truncate sm:block">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
