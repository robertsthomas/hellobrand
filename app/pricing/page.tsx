import { MarketingNav } from "@/components/marketing-nav";
import { PricingBillingToggle } from "@/components/pricing-billing-toggle";
import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { buildMarketingPlanAvailability } from "@/lib/billing/plans";

export default async function PricingPage() {
  const [plans, appSettings] = await Promise.all([
    buildMarketingPlanAvailability(),
    getAppSettings(),
  ]);

  if (!appSettings.publicSiteEnabled) {
    return (
      <RuntimeStatusPage
        eyebrow="Pricing paused"
        title="Pricing is hidden while the public site is paused."
        description="An admin has switched off public access, so marketing and pricing pages are currently unavailable."
        actionHref="/login"
        actionLabel="Go to login"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fefcfa] text-foreground dark:bg-[#0f1115]">
      <MarketingNav />

      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-semibold text-[#1a2634] dark:text-[#eef2f5]">
              Pricing for creators
            </h1>
            <p className="mt-5 text-lg text-black/60 dark:text-white/65">
              AI-powered partnership management from contract to payment. Start free with one
              partnership and upgrade as your workspace grows.
            </p>
          </div>

          <PricingBillingToggle plans={plans} />

          <p className="mt-8 text-center text-sm text-black/50 dark:text-white/40">
            Cancel anytime. No lock-in. One organized partnership can cover multiple months of
            HelloBrand.
          </p>
        </div>
      </section>

      <section className="border-t border-black/5 px-5 py-16 sm:px-8 lg:px-10 dark:border-white/5">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-[#1a2634] dark:text-[#eef2f5]">
            Trusted by creators who take partnerships seriously
          </h2>
          <p className="mt-3 text-center text-sm text-black/50 dark:text-white/40">
            From solo creators to full-time managers, HelloBrand helps protect the business side of
            influence.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <blockquote className="rounded-2xl border border-black/5 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-sm leading-relaxed text-[#1a2634] dark:text-[#eef2f5]">
                &ldquo;I used to lose track of deliverables and payment terms across five brand
                deals. HelloBrand caught a discrepancy in a contract that would have cost me
                $2,000.&rdquo;
              </p>
              <footer className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean/10 text-sm font-semibold text-ocean dark:bg-ocean/20">
                  JT
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a2634] dark:text-[#eef2f5]">Jamie T.</p>
                  <p className="text-xs text-black/40 dark:text-white/40">
                    Lifestyle creator, 120K followers
                  </p>
                </div>
              </footer>
            </blockquote>
            <blockquote className="rounded-2xl border border-black/5 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-sm leading-relaxed text-[#1a2634] dark:text-[#eef2f5]">
                &ldquo;Managing three creators used to mean spreadsheets and missed deadlines. Now
                everything is in one place and the AI flags conflicts before they become
                problems.&rdquo;
              </p>
              <footer className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean/10 text-sm font-semibold text-ocean dark:bg-ocean/20">
                  AR
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a2634] dark:text-[#eef2f5]">Alex R.</p>
                  <p className="text-xs text-black/40 dark:text-white/40">
                    Creator manager, 4-person roster
                  </p>
                </div>
              </footer>
            </blockquote>
            <blockquote className="rounded-2xl border border-black/5 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-sm leading-relaxed text-[#1a2634] dark:text-[#eef2f5]">
                &ldquo;The synced inbox changed everything. I can see brand emails next to contract
                terms and action items without switching tabs. Worth every penny.&rdquo;
              </p>
              <footer className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean/10 text-sm font-semibold text-ocean dark:bg-ocean/20">
                  MK
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a2634] dark:text-[#eef2f5]">
                    Morgan K.
                  </p>
                  <p className="text-xs text-black/40 dark:text-white/40">
                    Tech reviewer, 85K subscribers
                  </p>
                </div>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="border-t border-black/5 px-5 py-12 sm:px-8 lg:px-10 dark:border-white/5">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-black/40 dark:text-white/30">
            <span>Free plan available</span>
            <span className="hidden sm:inline" aria-hidden="true">
              &middot;
            </span>
            <span>Basic includes a 14-day trial. Premium includes a 7-day trial.</span>
            <span className="hidden sm:inline" aria-hidden="true">
              &middot;
            </span>
            <span>Cancel or downgrade anytime</span>
          </div>
        </div>
      </section>
    </div>
  );
}
