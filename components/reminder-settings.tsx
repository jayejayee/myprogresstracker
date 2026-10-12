"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { BellPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

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
  const [schedule, setSchedule] = useState("");
  const [repeatRule, setRepeatRule] = useState<Reminder["repeatRule"]>(
    initialReminder?.repeatRule ?? "once",
  );
  const [hasReminder, setHasReminder] = useState(initialReminder !== null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSchedule(
      initialReminder
        ? asLocalDateTime(initialReminder.nextAt)
        : defaultLocalDateTime(),
    );
  }, [initialReminder]);

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const details = event.currentTarget.closest("details");
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
      if (details) details.open = false;
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

    if (!error) setHasReminder(false);
    setMessage(error ? error.message : "Reminder removed.");
    setIsSaving(false);
  }

  return (
    <details className="group">
      <summary
        aria-label={`Set reminder for ${title}`}
        className="flex h-9 cursor-pointer list-none items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden"
      >
        <BellPlus
          aria-hidden="true"
          className={`size-4 ${hasReminder ? "fill-current" : "fill-none"}`}
        />
      </summary>
      <form
        onSubmit={saveReminder}
        className="mt-2 grid gap-3 rounded-md border bg-background p-3 sm:absolute sm:right-0 sm:z-10 sm:w-72 sm:shadow-md"
      >
        <label className="grid gap-1 text-xs font-medium">
          Date and time
          <input
            type="datetime-local"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
            required
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Repeat
          <select
            value={repeatRule}
            onChange={(event) =>
              setRepeatRule(event.target.value as Reminder["repeatRule"])
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="once">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
        {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
        <div className="flex items-center justify-between gap-2">
          {hasReminder && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeReminder}
              disabled={isSaving}
            >
              Remove
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSaving || !schedule} className="ml-auto">
            {isSaving ? "Saving..." : "Save reminder"}
          </Button>
        </div>
      </form>
    </details>
  );
}