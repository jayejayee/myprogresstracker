import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function LoginPageContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/protected/home");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <p className="text-sm text-muted-foreground">Checking your session...</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
