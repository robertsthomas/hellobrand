import Link from "next/link";

import { MarketingNav } from "@/components/marketing-nav";
import { buildMarketingPlanAvailability } from "@/lib/billing/plans";

export default async function PricingPage() {
  const plans = await buildMarketingPlanAvailability();

  return (
    <div className="min-h-screen">
      <MarketingNav />
      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-semibold text-ink">Pricing for creators</h1>
            <p className="mt-5 text-lg text-black/60 dark:text-white/65">
              AI-powered partnership management from contract to payment. Start
              with the essentials and upgrade as your workflow grows.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[2rem] border border-black/5 dark:border-white/10 p-7 shadow-panel ${
                  plan.popular
                    ? "bg-ocean text-white dark:bg-sand dark:text-[#18201d]"
                    : "bg-white/85 dark:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm uppercase tracking-[0.24em] opacity-65">
                    {plan.name}
                  </div>
                  {plan.popular && (
                    <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                      Most popular
                    </div>
                  )}
                </div>
                <div className="mt-4 text-5xl font-semibold">
                  {plan.displayMonthlyPriceLabel.replace("/mo", "")}
                  <span className="text-lg font-medium opacity-60">/mo</span>
                </div>
                <p className="mt-1 text-sm opacity-50">
                  {plan.displayAnnualEquivalentLabel}
                </p>
                <p className="mt-4 text-sm opacity-75">{plan.caption}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.marketingFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link
                  href="/waitlist"
                  className={`mt-8 inline-flex rounded-full px-5 py-3 text-sm font-semibold ${
                    plan.popular
                      ? "bg-white text-ocean dark:bg-white/90 dark:text-[#18201d]"
                      : "bg-ocean text-white dark:bg-sand dark:text-[#18201d]"
                  }`}
                >
                  Get started
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
