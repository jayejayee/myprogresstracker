import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-right gap-4">
      <LogoutButton />
    </div>
  ) : (
    <Link href="/auth/login" className="text-sm underline underline-offset-4">
      Sign in
    </Link>
  );
}
