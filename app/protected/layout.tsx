export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-5xl p-5 pb-24">
        {children}
      </div>
    </main>
  );
}
