"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Dumbbell, FolderKanban, History, House, ListTodo, Target, Timer, UserRound } from "lucide-react";

const mainNavigationItems = [
  { href: "/protected/home", label: "Home", icon: House },
  { href: "/protected/tasks", label: "Tasks", icon: ListTodo },
  { href: "/protected/workouts/log", label: "Workouts", icon: Dumbbell },
  { href: "/protected/profile", label: "Profile", icon: UserRound },
];

export function AppBottomNavigation() {
  const pathname = usePathname();
  const inTasks =
    pathname === "/protected/tasks" || pathname === "/protected/projects";
  const inTaskTools = inTasks || pathname === "/protected/focus";
  const inWorkouts = pathname.startsWith("/protected/workouts");

  const navigationItems = inTaskTools
    ? [
        { href: "/protected/home", label: "Main menu", icon: ArrowLeft },
        { href: "/protected/focus", label: "Focus timer", icon: Timer },
        { href: "/protected/projects", label: "Projects", icon: FolderKanban },
        { href: "/protected/tasks", label: "Tasks", icon: ListTodo },
      ]
    : inWorkouts
      ? [
          { href: "/protected/home", label: "Main menu", icon: ArrowLeft },
          { href: "/protected/workouts/stopwatch", label: "Stopwatch", icon: Timer },
          { href: "/protected/workouts/log", label: "Log workout", icon: Dumbbell },
          { href: "/protected/workouts/history", label: "History", icon: History },
          { href: "/protected/workouts/exercises", label: "Exercises", icon: Target },
        ]
      : mainNavigationItems;

  return (
    <nav
      aria-label={inTaskTools ? "Task navigation" : inWorkouts ? "Workout navigation" : "Main navigation"}
      className="fixed inset-x-0 bottom-0 z-50 bg-transparent pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pt-2"
    >
      <div className="mx-auto max-w-xl rounded-2xl border bg-background/95 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl">
        <div
          className={`grid min-w-0 ${
            navigationItems.length === 5 ? "grid-cols-5" : "grid-cols-4"
          } gap-1`}
        >
          {navigationItems.map(({ href, label, icon: Icon }) => {
            const isActive = inTaskTools
              ? (href === "/protected/focus" && pathname === href) ||
                (inTasks && pathname === href)
              : inWorkouts
                ? pathname === href || pathname.startsWith(`${href}/`)
                : href === "/protected"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-0.5 text-center text-[9px] font-semibold leading-[1.05] transition-colors sm:gap-1 sm:px-1 sm:text-[10px] ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 max-w-full whitespace-normal break-words">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
