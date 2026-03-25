import Link from "next/link";

import { Hand } from "lucide-react";

export function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#fefcfa] text-[#1a2634] dark:bg-[#0f1115] dark:text-[#eef2f5]">
      <main className="flex min-h-screen items-center justify-center px-5 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground">
            <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
          </div>
          <h1 className="mt-8 text-[2.6rem] font-bold leading-[0.95] tracking-[-0.05em] sm:text-[3.2rem]">
            HelloBrand is temporarily unavailable.
          </h1>
          <p className="mx-auto mt-5 max-w-[34rem] text-[1rem] leading-relaxed text-[#5d6876] dark:text-[#aab3bf]">
            Nothing is available right now. If you already have access, you can sign in.
            Otherwise, join the waitlist for updates.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-6 text-[15px] font-semibold text-foreground transition hover:bg-secondary dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
            >
              Sign in
            </Link>
            <Link
              href="/waitlist"
              className="inline-flex h-12 items-center justify-center bg-primary px-6 text-[15px] font-semibold text-white transition hover:bg-primary/92"
            >
              Join waitlist
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
