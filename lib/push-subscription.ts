import { createClient } from "@/lib/supabase/client";

function decodeVapidKey(key: string) {
  const padded = `${key}${"=".repeat((4 - (key.length % 4)) % 4)}`;
  const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export async function ensurePushSubscription(refresh = false) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error("Push notifications are not configured on the app yet.");
  }
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    throw new Error("This browser does not support push notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Allow notifications in your browser settings to enable phone alerts.",
    );
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
  if (!user) throw new Error("Sign in again to enable phone notifications.");

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

  return user.id;
}
