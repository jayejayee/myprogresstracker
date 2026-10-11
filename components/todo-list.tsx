"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { DottedProgress } from "@/components/dotted-progress";
import { Plus, Trash2 } from "lucide-react";
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
};

type TodoListProps = {
  initialTodos: Todo[];
  loadError: string | null;
};

export function TodoList({ initialTodos, loadError }: TodoListProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [specificDate, setSpecificDate] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState(loadError);
  const completedCount = todos.filter((todo) => todo.completed).length;
  const progress = todos.length
    ? Math.round((completedCount / todos.length) * 100)
    : 0;
  const today = getLocalToday();
  const startOfWeek = new Date(`${today}T12:00:00`);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const weekStart = formatLocalDate(startOfWeek);
  const weekEnd = addDays(weekStart, 6);
  const visibleTodos = todos
    .filter((todo) => {
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

  useEffect(() => {
    setNewDueDate(getLocalToday());
  }, []);

  async function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || isAdding) return;

    setIsAdding(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("todolist")
      .insert({ todo: title, todoby: newDueDate || null })
      .select("id, todo, todoby, completedstatus")
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
    }
    setPendingId(null);
  }

  return (
    <section className="mt-3">
      <div className="mb-5 flex items-center justify-between gap-6 border-b pb-5">
        <div>
          <h2 className="text-lg font-semibold">Your tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {completedCount} of {todos.length} completed
          </p>
        </div>
        <DottedProgress progress={progress} />
      </div>

      <form onSubmit={addTodo} className="flex flex-wrap gap-2">
        <Input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="Add a task"
          aria-label="New task"
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
        <label htmlFor="todo-day-filter" className="text-sm font-medium">
          Show
        </label>
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

      {errorMessage && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <ul className="mt-4 divide-y">
        {visibleTodos.map((todo) => (
          <li key={todo.id} className="flex min-h-14 items-center gap-3 py-2">
            <Checkbox
              id={`todo-${todo.id}`}
              checked={todo.completed}
              disabled={pendingId === todo.id}
              onCheckedChange={(checked) =>
                toggleTodo(todo, checked === true)
              }
            />
            <div className="flex-1">
              <label
                htmlFor={`todo-${todo.id}`}
                className={`text-sm ${todo.completed ? "text-muted-foreground line-through" : ""}`}
              >
                {todo.title}
              </label>
              {todo.dueDate && (
                <p className="text-xs text-muted-foreground">
                  Due {todo.dueDate}
                </p>
              )}
            </div>
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
          {todos.length
            ? "No tasks match this filter."
            : "No tasks yet. Add one above to get started."}
        </p>
      )}
    </section>
  );
}