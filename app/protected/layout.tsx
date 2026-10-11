import { AuthButton } from "@/components/auth-button";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
          {children}
        </div>

        <footer className="w-full flex items-center justify-between border-t mx-auto px-5 text-xs py-8">
          <span>Great job!</span>
          <Suspense fallback={null}>
            <AuthButton />
          </Suspense>
        </footer>
      </div>
    </main>
  );
}
