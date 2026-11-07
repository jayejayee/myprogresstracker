import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { PushNotifications } from "@/components/push-notifications";
import { WorkoutRestNotifications } from "@/components/workout-rest-notifications";
import { createClient } from "@/lib/supabase/server";

async function ProfileContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const name =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : "Not set";

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account details and app preferences.
        </p>
      </header>
      <dl className="divide-y rounded-lg border px-4">
        <div className="py-3">
          <dt className="text-xs text-muted-foreground">Name</dt>
          <dd className="mt-1 text-sm font-medium">{name}</dd>
        </div>
        <div className="py-3">
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="mt-1 break-all text-sm font-medium">{user.email ?? ""}</dd>
        </div>
      </dl>
      <PushNotifications />
      <WorkoutRestNotifications userId={user.id} />
      <LogoutButton />
    </section>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={<p className="py-8 text-sm text-muted-foreground">Loading your profile...</p>}
    >
      <ProfileContent />
    </Suspense>
  );
}
