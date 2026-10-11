import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT");

const supabase = createClient(supabaseUrl, serviceRoleKey);
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  );
}

function localTimeToUtc(parts, timezone) {
  const desiredUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let guess = desiredUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = localParts(new Date(guess), timezone);
    const representedUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    guess += desiredUtc - representedUtc;
  }

  return new Date(guess);
}

function nextOccurrence(instant, timezone, repeatRule, now) {
  if (repeatRule === "once") return null;

  let parts = localParts(new Date(instant), timezone);
  const nextLocal = { ...parts };

  const addDaysToParts = (days) => {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    nextLocal.year = date.getUTCFullYear();
    nextLocal.month = date.getUTCMonth() + 1;
    nextLocal.day = date.getUTCDate();
  };

  if (repeatRule === "daily") addDaysToParts(1);
  if (repeatRule === "weekly") addDaysToParts(7);
  if (repeatRule === "monthly") {
    const monthStart = new Date(Date.UTC(parts.year, parts.month, 1));
    const lastDay = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    ).getUTCDate();
    nextLocal.year = monthStart.getUTCFullYear();
    nextLocal.month = monthStart.getUTCMonth() + 1;
    nextLocal.day = Math.min(parts.day, lastDay);
  }

  let next = localTimeToUtc(nextLocal, timezone);
  let advances = 0;
  while (next.getTime() <= now.getTime() && advances < 500) {
    parts = localParts(next, timezone);
    Object.assign(nextLocal, parts);
    if (repeatRule === "daily") addDaysToParts(1);
    if (repeatRule === "weekly") addDaysToParts(7);
    if (repeatRule === "monthly") {
      const monthStart = new Date(Date.UTC(parts.year, parts.month, 1));
      const lastDay = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      ).getUTCDate();
      nextLocal.year = monthStart.getUTCFullYear();
      nextLocal.month = monthStart.getUTCMonth() + 1;
      nextLocal.day = Math.min(parts.day, lastDay);
    }
    next = localTimeToUtc(nextLocal, timezone);
    advances += 1;
  }

  return next;
}

Deno.serve(async (request) => {
  const now = new Date();
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("enabled", true)
    .lte("next_at", now.toISOString())
    .order("next_at", { ascending: true })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const reminder of reminders ?? []) {
    const sourceTable = reminder.entity_type === "project" ? "projects" : "todolist";
    const sourceIdColumn = "id";
    const sourceSelect = reminder.entity_type === "project" ? "id" : "id, completedstatus";
    const { data: source, error: sourceError } = await supabase
      .from(sourceTable)
      .select(sourceSelect)
      .eq(sourceIdColumn, reminder.entity_id)
      .eq("userprofile", reminder.userprofile)
      .maybeSingle();

    if (sourceError || !source || source.completedstatus === true) {
      await supabase
        .from("reminders")
        .update({ enabled: false })
        .eq("id", reminder.id)
        .eq("next_at", reminder.next_at);
      continue;
    }

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("userprofile", reminder.userprofile);

    if (subscriptionError || !subscriptions?.length) continue;

    const payload = JSON.stringify({
      title: reminder.entity_title,
      body: reminder.entity_type === "project" ? "Your project reminder is due." : "Your task reminder is due.",
      url: "/protected",
      tag: `${reminder.entity_type}-${reminder.entity_id}`,
    });

    let delivered = 0;
    for (const subscriptionRow of subscriptions) {
      const pushHost = new URL(subscriptionRow.endpoint).host;
      try {
        await webpush.sendNotification(subscriptionRow.subscription, payload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        sent += 1;
        delivered += 1;
        console.log("Push accepted by provider", {
          reminderId: reminder.id,
          pushHost,
        });
      } catch (pushError) {
        const status = pushError?.statusCode;
        console.error("Push delivery failed", {
          reminderId: reminder.id,
          pushHost,
          status,
          message: pushError?.message,
        });
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscriptionRow.endpoint);
        }
      }
    }

    if (delivered === 0) continue;

    const next = nextOccurrence(
      reminder.next_at,
      reminder.timezone,
      reminder.repeat_rule,
      now,
    );
    const { data: claimed, error: claimError } = await supabase
      .from("reminders")
      .update({ next_at: next?.toISOString() ?? reminder.next_at, enabled: next !== null })
      .eq("id", reminder.id)
      .eq("next_at", reminder.next_at)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("Could not advance delivered reminder", {
        reminderId: reminder.id,
        message: claimError.message,
      });
    } else if (!claimed) {
      console.warn("Reminder was updated by another sender", { reminderId: reminder.id });
    }
  }

  console.log("Reminder check complete", { due: reminders?.length ?? 0, sent });
  return Response.json({ sent });
});