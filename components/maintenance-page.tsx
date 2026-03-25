import Link from "next/link";

import { Mail, Wrench } from "lucide-react";

import { MarketingNav } from "@/components/marketing-nav";

export function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#fefcfa] text-foreground dark:bg-[#0f1115]">
      <MarketingNav />

      <main className="flex min-h-[calc(100vh-60px)] items-center px-5 py-16 sm:min-h-[calc(100vh-72px)] sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/70 dark:text-[#8ec6b1]/80">
              Maintenance mode
            </p>
            <h1 className="mt-5 max-w-[12ch] text-[2.8rem] font-bold leading-[0.95] tracking-[-0.05em] text-[#1a2634] sm:text-[3.6rem] dark:text-[#eef2f5]">
              HelloBrand is being prepared for launch.
            </h1>
            <p className="mt-6 max-w-[48ch] text-[1rem] leading-relaxed text-[#5d6876] sm:text-[1.08rem] dark:text-[#aab3bf]">
              We are polishing the public experience and tightening the product before
              opening access more broadly. The app will be available soon.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/waitlist"
                className="inline-flex h-12 items-center justify-center bg-primary px-6 text-[15px] font-semibold text-white shadow-md transition hover:bg-primary/92"
              >
                Join the waitlist
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-6 text-[15px] font-semibold text-foreground transition hover:bg-secondary dark:border-white/12 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              >
                Sign in
              </Link>
            </div>
          </section>

          <section className="border border-black/8 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#101318]">
            <div className="flex h-12 w-12 items-center justify-center bg-primary/[0.08] dark:bg-primary/[0.12]">
              <Wrench className="h-5 w-5 text-primary dark:text-[#8ec6b1]" />
            </div>

            <h2 className="mt-5 text-[1.4rem] font-semibold tracking-[-0.03em] text-foreground">
              What’s available right now
            </h2>
            <ul className="mt-5 space-y-3 text-[0.96rem] leading-relaxed text-muted-foreground">
              <li>Existing users can still sign in to access the product.</li>
              <li>The public landing experience will return when launch mode is enabled.</li>
              <li>Questions or partnership inquiries can be sent through the waitlist flow.</li>
            </ul>

            <div className="mt-8 border-t border-black/8 pt-5 dark:border-white/10">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>For updates, use the waitlist or your existing account access.</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
