import Link from "next/link";

import { MarketingNav } from "@/components/marketing-nav";

const tiers = [
  {
    name: "Basic",
    price: "$19",
    annualPrice: "$15",
    caption: "For creators getting started with active contract understanding and light operations",
    features: [
      "3 active partnership workspaces",
      "Document upload and paste intake",
      "AI extraction, summary, and risk review",
      "Editable partnership terms",
      "Basic deliverables and payments tracking",
      "Search and notifications",
      "AI assistant with monthly usage caps",
    ],
  },
  {
    name: "Standard",
    price: "$49",
    annualPrice: "$39",
    caption: "For active solo creators managing multiple brand partnerships",
    popular: true,
    features: [
      "Everything in Basic",
      "Unlimited active partnership workspaces",
      "Full AI assistant access",
      "Negotiation and follow-up drafting",
      "AI campaign brief generation",
      "Cross-partnership conflict detection",
      "Full document diff review",
      "Full deliverables, approvals, and payment workflow",
    ],
  },
  {
    name: "Premium",
    price: "$99",
    annualPrice: "$79",
    caption:
      "For power creators, managers, or creator businesses that want HelloBrand as an operational system",
    features: [
      "Everything in Standard",
      "Gmail / Outlook synced inbox",
      "Smart inbox matching and communication intelligence",
      "Action-item extraction from email",
      "Promise discrepancy detection",
      "Cross-partnership conflict surfacing from email",
      "Advanced analytics and reporting",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
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
            {tiers.map((tier, index) => (
              <article
                key={tier.name}
                className={`rounded-[2rem] border border-black/5 dark:border-white/10 p-7 shadow-panel ${
                  tier.popular ? "bg-ocean text-white dark:bg-sand dark:text-[#18201d]" : "bg-white/85 dark:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm uppercase tracking-[0.24em] opacity-65">
                    {tier.name}
                  </div>
                  {tier.popular && (
                    <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                      Most popular
                    </div>
                  )}
                </div>
                <div className="mt-4 text-5xl font-semibold">
                  {tier.price}
                  <span className="text-lg font-medium opacity-60">/mo</span>
                </div>
                <p className="mt-1 text-sm opacity-50">
                  {tier.annualPrice}/mo billed annually
                </p>
                <p className="mt-4 text-sm opacity-75">{tier.caption}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link
                  href="/waitlist"
                  className={`mt-8 inline-flex rounded-full px-5 py-3 text-sm font-semibold ${
                    tier.popular ? "bg-white text-ocean dark:bg-white/90 dark:text-[#18201d]" : "bg-ocean text-white dark:bg-sand dark:text-[#18201d]"
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
