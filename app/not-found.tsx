import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] p-8 text-center shadow-panel">
        <p className="text-xs uppercase tracking-[0.24em] text-black/45 dark:text-white/45">404</p>
        <h1 className="mt-4 font-serif text-5xl text-ocean">Page not found</h1>
        <p className="mt-4 text-sm leading-6 text-black/65 dark:text-white/70">
          The page you tried to open does not exist or you do not have access to it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
