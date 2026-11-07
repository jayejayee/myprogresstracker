"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { ensurePushSubscription } from "@/lib/push-subscription";
import { createClient } from "@/lib/supabase/client";

export function WorkoutRestNotifications({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreference() {
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase
          .from("workout_rest_alerts")
          .select("enabled")
          .eq("userprofile", userId)
          .maybeSingle();
        if (loadError) throw loadError;
        if (!cancelled) setEnabled(data?.enabled === true);
      } catch (loadError) {
        console.error(
          "Could not load workout rest notification preference.",
          loadError,
        );
        if (!cancelled) {
          setError(
            "Could not load this setting. Check that the workout rest alerts SQL setup has been applied.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggleNotifications() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      if (enabled) {
        const { error: updateError } = await supabase
          .from("workout_rest_alerts")
          .update({
            enabled: false,
            next_at: null,
            claimed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("userprofile", userId);
        if (updateError) throw updateError;
        setEnabled(false);
        return;
      }

      const subscribedUserId = await ensurePushSubscription();
      if (subscribedUserId !== userId) {
        throw new Error(
          "The notification subscription belongs to another account.",
        );
      }

      const { data: preference, error: readError } = await supabase
        .from("workout_rest_alerts")
        .select("userprofile")
        .eq("userprofile", userId)
        .maybeSingle();
      if (readError) throw readError;

      const values = {
        enabled: true,
        updated_at: new Date().toISOString(),
      };
      const { error: saveError } = preference
        ? await supabase
            .from("workout_rest_alerts")
            .update(values)
            .eq("userprofile", userId)
        : await supabase.from("workout_rest_alerts").insert({
            ...values,
            userprofile: userId,
            next_at: null,
            claimed_at: null,
          });
      if (saveError) throw saveError;
      setEnabled(true);
    } catch (toggleError) {
      console.error(
        "Could not update workout rest notification preference.",
        toggleError,
      );
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Could not save the workout rest notification setting.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Workout rest timer notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Get a push notification when a rest timer ends, including when the app
          is closed or your screen is locked.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Workout rest timer lock-screen alerts"
        onClick={toggleNotifications}
        disabled={loading || saving}
        className="inline-flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
      >
        {enabled ? (
          <BellRing
            aria-hidden="true"
            className="size-4 text-emerald-600"
          />
        ) : (
          <Bell aria-hidden="true" className="size-4" />
        )}
        <span>Lock-screen alerts {enabled ? "On" : "Off"}</span>
        <span
          aria-hidden="true"
          className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${enabled ? "bg-emerald-600" : "bg-muted"}`}
        >
          <span
            className={`size-5 rounded-full bg-background shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
          />
        </span>
        {(loading || saving) && (
          <span className="sr-only">
            {loading ? "Loading setting" : "Saving setting"}
          </span>
        )}
      </button>
      <p className="text-xs text-muted-foreground">
        This preference is saved to your account. Phone notifications must also
        be allowed for this device.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
