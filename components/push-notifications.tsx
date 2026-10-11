"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Bell, BellRing } from "lucide-react";
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
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.pushManager.getSubscription())
        .then((subscription) => {
          if (mounted && subscription) setIsEnabled(true);
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  async function enableNotifications() {
    if (!vapidKey) {
      setMessage("Push notifications are not configured on the app yet.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
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

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(vapidKey) as BufferSource,
        }));

      const supabase = createClient();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;

      setIsEnabled(true);
      setMessage("This device is ready for reminders.");
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
      const registration = await navigator.serviceWorker.getRegistration();
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
      setMessage("Test notification sent to this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not show a test notification.");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={enableNotifications} disabled={isEnabling || isEnabled}>
          <BellRing aria-hidden="true" />
          {isEnabled ? "Notifications enabled on this device" : isEnabling ? "Enabling..." : "Enable phone notifications"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={sendTestNotification}
          disabled={!isEnabled || isTesting}
        >
          <Bell aria-hidden="true" />
          {isTesting ? "Sending test..." : "Send test notification"}
        </Button>
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}