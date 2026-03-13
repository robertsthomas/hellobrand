import Link from "next/link";

import { MarketingNav } from "@/components/marketing-nav";

const tiers = [
  {
    name: "Starter",
    price: "$12",
    caption: "For creators doing a few deals each month",
    features: ["5 contract reviews", "Risk flags", "Email drafts"]
  },
  {
    name: "Pro",
    price: "$29",
    caption: "For active creators negotiating regularly",
    features: [
      "Unlimited contract reviews",
      "Deliverables tracking",
      "Payment reminder drafts"
    ]
  },
  {
    name: "Manager",
    price: "$79",
    caption: "For creator managers and small teams later on",
    features: ["Multi-creator workspaces", "Team visibility", "Priority support"]
  }
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
              Start simple, understand your deals faster, and upgrade when your
              deal flow gets busier.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {tiers.map((tier, index) => (
              <article
                key={tier.name}
                className={`rounded-[2rem] border border-black/5 dark:border-white/10 p-7 shadow-panel ${
                  index === 1 ? "bg-ocean text-white dark:bg-sand dark:text-[#18201d]" : "bg-white/85 dark:bg-white/[0.06]"
                }`}
              >
                <div className="text-sm uppercase tracking-[0.24em] opacity-65">
                  {tier.name}
                </div>
                <div className="mt-4 text-5xl font-semibold">
                  {tier.price}
                  <span className="text-lg font-medium opacity-60">/mo</span>
                </div>
                <p className="mt-4 text-sm opacity-75">{tier.caption}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link
                  href="/waitlist"
                  className={`mt-8 inline-flex rounded-full px-5 py-3 text-sm font-semibold ${
                    index === 1 ? "bg-white text-ocean dark:bg-white/90 dark:text-[#18201d]" : "bg-ocean text-white dark:bg-sand dark:text-[#18201d]"
                  }`}
                >
                  Join waitlist
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
