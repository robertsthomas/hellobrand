"use client";

import { useState } from "react";
import { Check } from "lucide-react";

type PlanData = {
  name: string;
  persona: string;
  monthlyPriceLabel: string;
  annualPriceLabel: string;
  annualEquivalentLabel: string;
  annualSavingsLabel: string;
  trialLabel: string;
  popular?: boolean;
  marketingFeatures: string[];
  caption: string;
  monthlyAvailable: boolean;
  yearlyAvailable: boolean;
};

export function PricingBillingToggle({ plans }: { plans: PlanData[] }) {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${!isAnnual ? "text-[#1a2634] dark:text-[#eef2f5]" : "text-black/40 dark:text-white/40"}`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isAnnual}
          aria-label="Toggle annual billing"
          onClick={() => setIsAnnual(!isAnnual)}
          className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-black/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean dark:border-white/10"
          style={{ backgroundColor: isAnnual ? "#1a4d3e" : "#d1d5db" }}
        >
          <span
            className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: isAnnual ? "translateX(26px)" : "translateX(2px)" }}
          />
        </button>
        <span
          className={`text-sm font-medium ${isAnnual ? "text-[#1a2634] dark:text-[#eef2f5]" : "text-black/40 dark:text-white/40"}`}
        >
          Annual
        </span>
        {isAnnual && (
          <span className="rounded-full bg-sage/20 px-2.5 py-0.5 text-xs font-semibold text-sage dark:text-sage">
            Save up to 20%
          </span>
        )}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const priceLabel =
            isAnnual && plan.yearlyAvailable ? plan.annualPriceLabel : plan.monthlyPriceLabel;
          const priceNum = priceLabel.replace(/[^0-9]/g, "");
          const period = isAnnual && plan.yearlyAvailable ? "/yr" : "/mo";
          const showSavings = isAnnual && plan.yearlyAvailable;

          return (
            <article
              key={plan.name}
              className={`rounded-[2rem] border p-7 shadow-panel ${
                plan.popular
                  ? "border-ocean/20 bg-ocean text-white dark:border-white/10 dark:bg-sand dark:text-[#18201d]"
                  : "border-black/5 bg-white/85 dark:border-white/10 dark:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm uppercase tracking-[0.24em] opacity-65">{plan.name}</div>
                {plan.popular && (
                  <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                    Most popular
                  </div>
                )}
              </div>

              <div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] opacity-50">
                {plan.persona}
              </div>

              <div className="mt-4 text-5xl font-semibold">
                ${priceNum}
                <span className="text-lg font-medium opacity-60">{period}</span>
              </div>

              {showSavings ? (
                <p className="mt-1 text-sm font-medium opacity-70">
                  {plan.annualEquivalentLabel}
                  <span className="ml-2 rounded-full bg-sage/20 px-2 py-0.5 text-xs text-sage dark:text-sage">
                    {plan.annualSavingsLabel}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm opacity-50">
                  {plan.yearlyAvailable ? plan.annualEquivalentLabel : "Monthly billing only"}
                </p>
              )}

              <p className="mt-4 text-sm opacity-75">{plan.caption}</p>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.marketingFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      aria-hidden="true"
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.popular ? "opacity-70" : "text-ocean dark:text-ocean"
                      }`}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`/login?mode=sign-up`}
                data-plan={plan.name.toLowerCase()}
                data-billing={isAnnual ? "annual" : "monthly"}
                className={`mt-8 inline-flex rounded-full px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  plan.popular
                    ? "bg-white text-ocean dark:bg-white/90 dark:text-[#18201d]"
                    : "bg-ocean text-white dark:bg-sand dark:text-[#18201d]"
                }`}
              >
                Start {plan.trialLabel}
              </a>
            </article>
          );
        })}
      </div>
    </>
  );
}
