"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { BellPlus, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type Reminder = {
  entityType: "task" | "project";
  entityId: number;
  title: string;
  nextAt: string;
  repeatRule: "once" | "daily" | "weekly" | "monthly";
  timezone: string;
};

type ReminderSettingsProps = {
  entityType: Reminder["entityType"];
  entityId: number;
  title: string;
  initialReminder: Reminder | null;
};

function asLocalDateTime(value: string) {
  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function defaultLocalDateTime() {
  const date = new Date(Date.now() + 5 * 60_000);
  date.setSeconds(0, 0);
  return asLocalDateTime(date.toISOString());
}

export function ReminderSettings({
  entityType,
  entityId,
  title,
  initialReminder,
}: ReminderSettingsProps) {
  const [schedule, setSchedule] = useState(
    initialReminder ? asLocalDateTime(initialReminder.nextAt) : "",
  );
  const [repeatRule, setRepeatRule] = useState<Reminder["repeatRule"]>(
    initialReminder?.repeatRule ?? "once",
  );
  const [hasReminder, setHasReminder] = useState(initialReminder !== null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving]);

  function openReminder() {
    if (!schedule) setSchedule(defaultLocalDateTime());
    setMessage(null);
    setIsOpen(true);
  }

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schedule || new Date(schedule).getTime() <= Date.now()) {
      setMessage("Choose a future date and time.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.from("reminders").upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        entity_title: title,
        next_at: new Date(schedule).toISOString(),
        repeat_rule: repeatRule,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        enabled: true,
      },
      { onConflict: "userprofile,entity_type,entity_id" },
    );

    if (!error) {
      setHasReminder(true);
      setIsOpen(false);
    }
    setMessage(error ? error.message : "Reminder saved.");
    setIsSaving(false);
  }

  async function removeReminder() {
    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);

    if (!error) {
      setHasReminder(false);
      setIsOpen(false);
    }
    setMessage(error ? error.message : "Reminder removed.");
    setIsSaving(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Set reminder for ${title}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={openReminder}
        className="flex h-9 cursor-pointer list-none items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden"
      >
        <BellPlus
          aria-hidden="true"
          className={`size-4 ${hasReminder ? "fill-current" : "fill-none"}`}
        />
      </button>
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isSaving) {
                setIsOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby={`reminder-title-${entityType}-${entityId}`}
              className="w-full max-w-sm rounded-xl border bg-card p-5 text-card-foreground shadow-xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2
                    id={`reminder-title-${entityType}-${entityId}`}
                    className="text-lg font-semibold"
                  >
                    {hasReminder ? "Edit reminder" : "Add reminder"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{title}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close reminder dialog"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <form onSubmit={saveReminder} className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  Date and time
                  <input
                    type="datetime-local"
                    value={schedule}
                    onChange={(event) => setSchedule(event.target.value)}
                    required
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Repeat
                  <select
                    value={repeatRule}
                    onChange={(event) =>
                      setRepeatRule(event.target.value as Reminder["repeatRule"])
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="once">Does not repeat</option>
                    <option value="daily">Every day</option>
                    <option value="weekly">Every week</option>
                    <option value="monthly">Every month</option>
                  </select>
                </label>
                {message && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {message}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  {hasReminder && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeReminder}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Remove"}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSaving || !schedule}
                    className="ml-auto"
                  >
                    {isSaving ? "Saving..." : "Save reminder"}
                  </Button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}