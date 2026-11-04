"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Dumbbell, FolderKanban, History, House, ListTodo, Target, UserRound } from "lucide-react";

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
          { href: "/protected/workouts", label: "Log workout", icon: Dumbbell },
          { href: "/protected/workouts/history", label: "History", icon: History },
          { href: "/protected/workouts/exercises", label: "Exercises & goals", icon: Target },
        ]
      : mainNavigationItems;

  return (
    <nav
      aria-label={inTasks ? "Task navigation" : inWorkouts ? "Workout navigation" : "Main navigation"}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto max-w-2xl px-2 py-2">
        <div className={`grid ${navigationItems.length === 3 ? "grid-cols-3" : "grid-cols-4"} gap-1`}>
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
                className={`flex h-12 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium ${
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
