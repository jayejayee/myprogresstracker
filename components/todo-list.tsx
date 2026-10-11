"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { DottedProgress } from "@/components/dotted-progress";
import { ReminderSettings, type Reminder } from "@/components/reminder-settings";
import { PushNotifications } from "@/components/push-notifications";
import { ArrowLeft, CalendarDays, FolderOpen, FolderPlus, FolderKanban, ListTodo, Plus, Search, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

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

type Todo = {
  id: number;
  title: string;
  dueDate: string | null;
  completed: boolean;
  projectId: number | null;
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
  const [activeView, setActiveView] = useState<"projects" | "tasks" | "profile">("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDueDate, setNewProjectDueDate] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
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
      if (first.completed !== second.completed) {
        return Number(first.completed) - Number(second.completed);
      }
      if (!first.dueDate) return second.dueDate ? 1 : 0;
      if (!second.dueDate) return -1;
      return first.dueDate.localeCompare(second.dueDate);
    });
  const completedCount = visibleTodos.filter((todo) => todo.completed).length;
  const progress = visibleTodos.length
    ? Math.round((completedCount / visibleTodos.length) * 100)
    : 0;

  useEffect(() => {
    setNewDueDate(getLocalToday());
    setNewProjectDueDate(getLocalToday());
  }, []);

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
      .insert({ todo: title, todoby: newDueDate || null, projectid: selectedProjectId })
      .select("id, todo, todoby, completedstatus, projectid")
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
        },
        ...currentTodos,
      ]);
      setNewTitle("");
      setNewDueDate(getLocalToday());
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

            <form onSubmit={addTodo} className="flex flex-wrap gap-2">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder={selectedProject ? `Add a task to ${selectedProject.name}` : "Add an unassigned task"}
                aria-label={selectedProject ? `New task for ${selectedProject.name}` : "New unassigned task"}
                maxLength={200}
                required
                className="min-w-40 flex-1"
              />
              <Input
                type="date"
                value={newDueDate}
                onChange={(event) => setNewDueDate(event.target.value)}
                aria-label="Task due date"
                className="w-40"
              />
              <Button type="submit" disabled={isAdding || !newTitle.trim()}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label htmlFor="todo-day-filter" className="text-sm font-medium">Show</label>
              <select
                id="todo-day-filter"
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value as DayFilter)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All tasks</option>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="week">This week</option>
                <option value="specific">Choose a day</option>
                <option value="unscheduled">No due date</option>
              </select>
              {dayFilter === "specific" && (
                <Input
                  type="date"
                  value={specificDate}
                  onChange={(event) => setSpecificDate(event.target.value)}
                  aria-label="Filter tasks by date"
                  className="w-40"
                />
              )}
              <span className="text-sm text-muted-foreground">
                {visibleTodos.length} {visibleTodos.length === 1 ? "task" : "tasks"}
              </span>
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
              onClick={() => setActiveView("profile")}
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