export function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-semibold text-foreground">404</p>
      <p className="text-muted-foreground">
        This page doesn’t exist.
      </p>
      <a
        href="/"
        className="mt-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        Back to chat
      </a>
    </main>
  );
}
