"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { DottedProgress } from "@/components/dotted-progress";
import { ReminderSettings, type Reminder } from "@/components/reminder-settings";
import { PushNotifications } from "@/components/push-notifications";
import { ArrowLeft, ArrowUpDown, CalendarDays, FolderOpen, FolderPlus, FolderKanban, ListTodo, Plus, Search, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

function getLocalToday() {
  const now = new Date();
  return formatLocalDate(now);
}

function formatLocalDate(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

type DayFilter = "all" | "today" | "tomorrow" | "week" | "specific" | "unscheduled";
type Priority = "high" | "medium" | "low";

const priorityDotClass: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-400",
  low: "bg-emerald-500",
};

const priorityLabel: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type Todo = {
  id: number;
  title: string;
  dueDate: string | null;
  completed: boolean;
  projectId: number | null;
  priority: Priority;
};

type Project = {
  id: number;
  name: string;
  dueDate: string;
};

type TodoListProps = {
  initialTodos: Todo[];
  initialProjects: Project[];
  initialReminders: Reminder[];
  loadError: string | null;
  profileName: string;
  profileEmail: string;
  logoutAction: React.ReactNode;
};

export function TodoList({
  initialTodos,
  initialProjects,
  initialReminders,
  loadError,
  profileName,
  profileEmail,
  logoutAction,
}: TodoListProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [projects, setProjects] = useState(initialProjects);
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeView, setActiveView] = useState<"projects" | "tasks" | "profile">("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDueDate, setNewProjectDueDate] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const taskDialogRef = useRef<HTMLDialogElement>(null);
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [sortBy, setSortBy] = useState<"priority" | "dueDate">("priority");
  const [specificDate, setSpecificDate] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState(loadError);
  const today = getLocalToday();
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const filteredProjects = projects.filter((project) =>
    project.name.toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase()),
  );
  const startOfWeek = new Date(`${today}T12:00:00`);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const weekStart = formatLocalDate(startOfWeek);
  const weekEnd = addDays(weekStart, 6);
  const visibleTodos = todos
    .filter((todo) => {
      if (selectedProjectId !== null && todo.projectId !== selectedProjectId) return false;
      if (dayFilter === "all") return true;
      if (dayFilter === "unscheduled") return todo.dueDate === null;
      if (!todo.dueDate) return false;
      if (dayFilter === "today") return todo.dueDate === today;
      if (dayFilter === "tomorrow") return todo.dueDate === addDays(today, 1);
      if (dayFilter === "week") {
        return todo.dueDate >= weekStart && todo.dueDate <= weekEnd;
      }
      return todo.dueDate === specificDate;
    })
    .sort((first, second) => {
      const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
      if (sortBy === "priority") {
        if (first.priority !== second.priority) {
          return priorityOrder[first.priority] - priorityOrder[second.priority];
        }
        if (first.completed !== second.completed) {
          return Number(first.completed) - Number(second.completed);
        }
      } else {
        if (first.completed !== second.completed) {
          return Number(first.completed) - Number(second.completed);
        }
        if (!first.dueDate && second.dueDate) return 1;
        if (first.dueDate && !second.dueDate) return -1;
        if (first.dueDate && second.dueDate) {
          const dueDateOrder = first.dueDate.localeCompare(second.dueDate);
          if (dueDateOrder !== 0) return dueDateOrder;
        }
      }
      return priorityOrder[first.priority] - priorityOrder[second.priority];
    });
  const completedCount = visibleTodos.filter((todo) => todo.completed).length;
  const progress = visibleTodos.length
    ? Math.round((completedCount / visibleTodos.length) * 100)
    : 0;

  useEffect(() => {
    setNewDueDate(getLocalToday());
    setNewProjectDueDate(getLocalToday());
  }, []);

  useEffect(() => {
    const dialog = taskDialogRef.current;
    if (!dialog) return;

    if (isAddTaskOpen && !dialog.open) dialog.showModal();
    if (!isAddTaskOpen && dialog.open) dialog.close();
  }, [isAddTaskOpen]);

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name || !newProjectDueDate || isAddingProject) return;

    setIsAddingProject(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, due_date: newProjectDueDate })
      .select("id, name, due_date")
      .single();

    if (error) {
      setErrorMessage(error.message);
    } else {
      setProjects((currentProjects) =>
        [...currentProjects, { id: data.id, name: data.name, dueDate: data.due_date }]
          .sort((first, second) => first.dueDate.localeCompare(second.dueDate)),
      );
      setNewProjectName("");
      setNewProjectDueDate(getLocalToday());
      setSelectedProjectId(data.id);
      setDayFilter("all");
      setActiveView("tasks");
      setShowWelcome(false);
    }
    setIsAddingProject(false);
  }

  async function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || isAdding) return;

    setIsAdding(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("todolist")
      .insert({
        todo: title,
        todoby: newDueDate || null,
        projectid: selectedProjectId,
        priority: newPriority,
      })
      .select("id, todo, todoby, completedstatus, projectid, priority")
      .single();

    if (error) {
      setErrorMessage(error.message);
    } else {
      setTodos((currentTodos) => [
        {
          id: data.id,
          title: data.todo,
          dueDate: data.todoby,
          completed: data.completedstatus,
          projectId: data.projectid,
          priority: data.priority as Priority,
        },
        ...currentTodos,
      ]);
      setNewTitle("");
      setNewDueDate(getLocalToday());
      setNewPriority("medium");
      setIsAddTaskOpen(false);
    }
    setIsAdding(false);
  }

  async function toggleTodo(todo: Todo, completed: boolean) {
    if (pendingId) return;

    setPendingId(todo.id);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("todolist")
      .update({ completedstatus: completed })
      .eq("id", todo.id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setTodos((currentTodos) =>
        currentTodos.map((item) =>
          item.id === todo.id ? { ...item, completed } : item,
        ),
      );
    }
    setPendingId(null);
  }

  async function updatePriority(todo: Todo, priority: Priority) {
    if (pendingId || todo.priority === priority) return;

    setPendingId(todo.id);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("todolist")
      .update({ priority })
      .eq("id", todo.id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setTodos((currentTodos) =>
        currentTodos.map((item) =>
          item.id === todo.id ? { ...item, priority } : item,
        ),
      );
    }
    setPendingId(null);
  }

  async function deleteTodo(todoId: number) {
    if (pendingId) return;

    setPendingId(todoId);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("todolist")
      .delete()
      .eq("id", todoId);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setTodos((currentTodos) =>
        currentTodos.filter((todo) => todo.id !== todoId),
      );
      await supabase
        .from("reminders")
        .delete()
        .eq("entity_type", "task")
        .eq("entity_id", todoId);
    }
    setPendingId(null);
  }

  return (
    <>
      {showWelcome && (
        <h1 className="py-4 text-3xl font-semibold">Welcome back!</h1>
      )}
      <section className="mt-3 pb-24">
        {errorMessage && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        {activeView === "projects" ? (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Projects</h2>
            <form onSubmit={addProject} className="flex flex-wrap gap-2">
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="New project name"
                aria-label="New project name"
                maxLength={120}
                required
                className="min-w-40 flex-1"
              />
              <Input
                type="date"
                value={newProjectDueDate}
                onChange={(event) => setNewProjectDueDate(event.target.value)}
                aria-label="Project due date"
                required
                className="w-40"
              />
              <Button type="submit" disabled={isAddingProject || !newProjectName.trim()}>
                <FolderPlus aria-hidden="true" />
                Add project
              </Button>
            </form>
            <div className="relative mt-4">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="pl-9"
              />
            </div>
            {filteredProjects.length ? (
              <ul className="mt-4 divide-y">
                {filteredProjects.map((project) => {
                  const projectTodos = todos.filter((todo) => todo.projectId === project.id);
                  const doneCount = projectTodos.filter((todo) => todo.completed).length;
                  return (
                    <li key={project.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setActiveView("tasks");
                          setDayFilter("all");
                          setShowWelcome(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left hover:bg-accent/50"
                      >
                        <FolderOpen aria-hidden="true" className="size-5 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{project.name}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Due {project.dueDate} · {doneCount}/{projectTodos.length} tasks complete
                          </span>
                        </span>
                      </button>
                      <ReminderSettings
                        entityType="project"
                        entityId={project.id}
                        title={project.name}
                        initialReminder={initialReminders.find(
                          (reminder) =>
                            reminder.entityType === "project" &&
                            reminder.entityId === project.id,
                        ) ?? null}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {projects.length ? "No projects match your search." : "No projects yet. Add one above to get started."}
              </p>
            )}
          </div>
        ) : activeView === "profile" ? (
          <section aria-labelledby="profile-heading" className="space-y-5">
            <div>
              <h2 id="profile-heading" className="text-lg font-semibold">Profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">Account details and sign out</p>
            </div>
            <dl className="divide-y border-y">
              <div className="py-3">
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="mt-1 text-sm font-medium">{profileName}</dd>
              </div>
              <div className="py-3">
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-1 break-all text-sm font-medium">{profileEmail}</dd>
              </div>
            </dl>
            <PushNotifications />
            {logoutAction}
          </section>
        ) : (
          <div>
            {selectedProject ? (
              <div className="mb-5 border-b pb-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="mb-3 -ml-3"
                  onClick={() => {
                    setSelectedProjectId(null);
                    setActiveView("projects");
                    setShowWelcome(false);
                  }}
                >
                  <ArrowLeft aria-hidden="true" />
                  All projects
                </Button>
                <h2 className="text-xl font-semibold">{selectedProject.name}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  Project due {selectedProject.dueDate}
                </p>
              </div>
            ) : null}

            <div className="mb-5 flex items-center justify-between gap-6 border-b pb-5">
              <div>
                <h2 className="text-lg font-semibold">{selectedProject ? "Project tasks" : "All tasks"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {completedCount} of {visibleTodos.length} completed
                </p>
              </div>
              <DottedProgress progress={progress} />
            </div>

            <dialog
              ref={taskDialogRef}
              aria-labelledby="add-task-title"
              onCancel={(event) => {
                event.preventDefault();
                setIsAddTaskOpen(false);
              }}
              onClick={(event) => {
                if (event.target === event.currentTarget) setIsAddTaskOpen(false);
              }}
              className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
            >
              <form onSubmit={addTodo} className="space-y-5 p-5">
                <div>
                  <h3 id="add-task-title" className="text-lg font-semibold">New task</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedProject ? `For ${selectedProject.name}` : "Add a task to your list"}
                  </p>
                </div>
                <div className="space-y-4">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Task
                    <Input
                      autoFocus
                      value={newTitle}
                      onChange={(event) => setNewTitle(event.target.value)}
                      placeholder={selectedProject ? `Add a task to ${selectedProject.name}` : "What needs to be done?"}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                    Due date
                    <Input
                      type="date"
                      value={newDueDate}
                      onChange={(event) => setNewDueDate(event.target.value)}
                      aria-label="Task due date"
                      className="box-border h-10 w-full min-w-0 max-w-full"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Priority
                    <select
                      value={newPriority}
                      onChange={(event) => setNewPriority(event.target.value as Priority)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="high">High · Red</option>
                      <option value="medium">Medium · Yellow</option>
                      <option value="low">Low · Green</option>
                    </select>
                  </label>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsAddTaskOpen(false)}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isAdding || !newTitle.trim()}>
                    <Plus aria-hidden="true" />
                    {isAdding ? "Adding..." : "Add task"}
                  </Button>
                </div>
              </form>
            </dialog>

            <div className="mt-4 flex w-full flex-nowrap items-center justify-center gap-2 rounded-md bg-muted/30 p-2">
              <label htmlFor="todo-day-filter" className="sr-only">Filter tasks by due date</label>
              <select
                id="todo-day-filter"
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value as DayFilter)}
                aria-label="Filter tasks by due date"
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm sm:flex-none"
              >
                <option value="all">All</option>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="week">This week</option>
                <option value="specific">Pick date</option>
                <option value="unscheduled">Unscheduled</option>
              </select>
              {dayFilter === "specific" && (
                <Input
                  type="date"
                  value={specificDate}
                  onChange={(event) => setSpecificDate(event.target.value)}
                  aria-label="Filter tasks by date"
                  className="w-40 bg-background"
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 bg-background">
                    <ArrowUpDown aria-hidden="true" />
                    {sortBy === "priority" ? "Priority" : "Due date"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort tasks by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as "priority" | "dueDate")}
                  >
                    <DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dueDate">Due date</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddTaskOpen(true)}
                className="shrink-0"
              >
                <Plus aria-hidden="true" />
                Add task
              </Button>
            </div>

            <ul className="mt-4 divide-y">
              {visibleTodos.map((todo) => (
                <li key={todo.id} className="relative flex min-h-14 items-center gap-2 py-2">
                  <Checkbox
                    id={`todo-${todo.id}`}
                    checked={todo.completed}
                    disabled={pendingId === todo.id}
                    onCheckedChange={(checked) => toggleTodo(todo, checked === true)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`${priorityLabel[todo.priority]} priority. Change priority for ${todo.title}`}
                        disabled={pendingId === todo.id}
                        className="size-8 shrink-0"
                      >
                        <span
                          aria-hidden="true"
                          className={`size-3 rounded-full ${priorityDotClass[todo.priority]}`}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Task priority</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={todo.priority}
                        onValueChange={(value) => updatePriority(todo, value as Priority)}
                      >
                        {(["high", "medium", "low"] as const).map((priority) => (
                          <DropdownMenuRadioItem key={priority} value={priority}>
                            <span
                              aria-hidden="true"
                              className={`size-2.5 rounded-full ${priorityDotClass[priority]}`}
                            />
                            {priorityLabel[priority]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex-1">
                    <label
                      htmlFor={`todo-${todo.id}`}
                      className={`text-sm ${todo.completed ? "text-muted-foreground line-through" : ""}`}
                    >
                      {todo.title}
                    </label>
                    {todo.dueDate && (
                      <p className="text-xs text-muted-foreground">Due {todo.dueDate}</p>
                    )}
                  </div>
                  <ReminderSettings
                    entityType="task"
                    entityId={todo.id}
                    title={todo.title}
                    initialReminder={initialReminders.find(
                      (reminder) =>
                        reminder.entityType === "task" &&
                        reminder.entityId === todo.id,
                    ) ?? null}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${todo.title}`}
                    disabled={pendingId === todo.id}
                    onClick={() => deleteTodo(todo.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>

            {!visibleTodos.length && !errorMessage && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {todos.length ? "No tasks match this filter." : "No tasks yet. Add one above to get started."}
              </p>
            )}
          </div>
        )}
      </section>

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-1 px-2 py-3">
          <div className="grid w-full grid-cols-3 gap-1" role="group" aria-label="Sections">
            <Button
              type="button"
              variant={activeView === "projects" ? "secondary" : "ghost"}
              className="h-12 w-full"
              aria-current={activeView === "projects" ? "page" : undefined}
              onClick={() => {
                setSelectedProjectId(null);
                setActiveView("projects");
                setShowWelcome(false);
              }}
            >
              <FolderKanban aria-hidden="true" />
              Projects
            </Button>
            <Button
              type="button"
              variant={activeView === "tasks" ? "secondary" : "ghost"}
              className="h-12 w-full"
              aria-current={activeView === "tasks" ? "page" : undefined}
              onClick={() => {
                setSelectedProjectId(null);
                setActiveView("tasks");
                setShowWelcome(false);
              }}
            >
              <ListTodo aria-hidden="true" />
              Tasks
            </Button>
            <Button
              type="button"
              variant={activeView === "profile" ? "secondary" : "ghost"}
              className="h-12 w-full"
              aria-current={activeView === "profile" ? "page" : undefined}
              onClick={() => {
                setActiveView("profile");
                setShowWelcome(false);
              }}
            >
              <UserRound aria-hidden="true" />
              Profile
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
}