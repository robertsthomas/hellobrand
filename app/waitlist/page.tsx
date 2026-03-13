import { MarketingNav } from "@/components/marketing-nav";

export default function WaitlistPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <section className="flex min-h-[calc(100vh-4rem)] items-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] p-8 shadow-panel">
          <h1 className="text-4xl font-semibold text-ink">Join the HelloBrand waitlist</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Be first in line for contract summaries, watchouts, deliverables
            tracking, and negotiation-ready creator emails.
          </p>
          <form className="mt-8 grid gap-4">
            <input
              className="rounded-[1.25rem] border-black/10 dark:border-white/12 bg-sand/50 dark:bg-white/[0.05] px-4 py-4"
              placeholder="Email address"
            />
            <input
              className="rounded-[1.25rem] border-black/10 dark:border-white/12 bg-sand/50 dark:bg-white/[0.05] px-4 py-4"
              placeholder="Creator handle"
            />
            <button className="inline-flex w-fit rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white">
              Join waitlist
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
