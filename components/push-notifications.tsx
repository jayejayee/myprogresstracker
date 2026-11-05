"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Bell, BellRing, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

function decodeVapidKey(key: string) {
  const padded = `${key}${"=".repeat((4 - (key.length % 4)) % 4)}`;
  const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function PushNotifications() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let mounted = true;
    async function syncSubscription() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;

        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        const { error } = await supabase.from("push_subscriptions").upsert(
          {
            endpoint: subscription.endpoint,
            subscription: subscription.toJSON(),
            userprofile: user.id,
          },
          { onConflict: "endpoint" },
        );
        if (error) throw error;
        if (mounted) setIsEnabled(true);
      } catch (error) {
        if (mounted) {
          setMessage(
            error instanceof Error
              ? `Could not sync this device's notification subscription: ${error.message}`
              : "Could not sync this device's notification subscription.",
          );
        }
      }
    }

    syncSubscription();
    return () => {
      mounted = false;
    };
  }, []);

  async function enableNotifications(refresh = false) {
    if (!vapidKey) {
      setMessage("Push notifications are not configured on the app yet.");
      return;
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setMessage("This browser does not support push notifications.");
      return;
    }

    setIsEnabling(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Allow notifications in your browser settings to enable reminders.");
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sign in again to enable notifications.");

      if (subscription && refresh) {
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(vapidKey) as BufferSource,
        });
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
          userprofile: user.id,
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;

      setIsEnabled(true);
      setMessage(refresh ? "This device's reminder subscription was refreshed." : "This device is ready for reminders.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setIsEnabling(false);
    }
  }

  async function sendTestNotification() {
    if (!isEnabled) {
      setMessage("Enable phone notifications on this device first.");
      return;
    }
    if (Notification.permission !== "granted") {
      setMessage("Notifications are blocked in this browser's settings.");
      return;
    }

    setIsTesting(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration?.pushManager.getSubscription();
      if (!registration || !subscription) {
        setIsEnabled(false);
        throw new Error("This device is not subscribed. Enable phone notifications again.");
      }

      await registration.showNotification("Test reminder", {
        body: "Notifications are working on this device.",
        icon: "/opengraph-image.png",
        data: { url: "/protected" },
        tag: "test-reminder",
      });
      setMessage("Local test notification shown. Scheduled reminders are delivered by Supabase.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not show a test notification.");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => enableNotifications()} disabled={isEnabling || isEnabled}>
          <BellRing aria-hidden="true" />
          {isEnabled ? "Notifications enabled on this device" : isEnabling ? "Enabling..." : "Enable phone notifications"}
        </Button>
        {isEnabled && (
          <Button
            type="button"
            variant="outline"
            onClick={() => enableNotifications(true)}
            disabled={isEnabling}
          >
            <RefreshCw aria-hidden="true" />
            {isEnabling ? "Refreshing..." : "Refresh this device"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={sendTestNotification}
          disabled={!isEnabled || isTesting}
        >
          <Bell aria-hidden="true" />
          {isTesting ? "Showing test..." : "Show local test notification"}
        </Button>
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}