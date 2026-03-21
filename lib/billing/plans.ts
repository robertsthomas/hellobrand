import { BillingInterval, BillingSubscriptionStatus, PlanTier } from "@prisma/client";

import { hasStripePriceId } from "@/lib/billing/config";

export type BillingPlanCatalogEntry = {
  tier: PlanTier;
  name: string;
  monthlyPriceLabel: string;
  annualPriceLabel: string;
  annualEquivalentLabel: string;
  summary: string;
  features: string[];
};

export type BillingPlanAvailability = BillingPlanCatalogEntry & {
  monthlyAvailable: boolean;
  yearlyAvailable: boolean;
  trialLabel: string;
};

export type BillingOverview = {
  stripeConfigured: boolean;
  billingReady: boolean;
  billingErrorMessage: string | null;
  currentPlanTier: PlanTier | null;
  currentPlanInterval: BillingInterval | null;
  currentSubscriptionStatus: BillingSubscriptionStatus | null;
  currentTrialPlanTier: PlanTier | null;
  currentTrialEndsAt: string | null;
  planCatalog: BillingPlanAvailability[];
  hasActiveSubscription: boolean;
};

const BILLING_PLAN_CATALOG: BillingPlanCatalogEntry[] = [
  {
    tier: PlanTier.basic,
    name: "Basic",
    monthlyPriceLabel: "$19/mo",
    annualPriceLabel: "$180/yr",
    annualEquivalentLabel: "$15/mo billed annually",
    summary: "Core partnership intelligence for lighter creator workflows.",
    features: [
      "3 active workspaces",
      "AI extraction, summary, and risk review",
      "Basic deliverables and payment tracking",
      "AI assistant with capped usage"
    ]
  },
  {
    tier: PlanTier.standard,
    name: "Standard",
    monthlyPriceLabel: "$49/mo",
    annualPriceLabel: "$468/yr",
    annualEquivalentLabel: "$39/mo billed annually",
    summary: "The full solo-creator workflow with deeper AI and workspace operations.",
    features: [
      "Everything in Basic",
      "Higher workspace limits",
      "Full AI drafting and brief generation",
      "Conflict intelligence and deeper workflow tools"
    ]
  },
  {
    tier: PlanTier.premium,
    name: "Premium",
    monthlyPriceLabel: "$99/mo",
    annualPriceLabel: "$948/yr",
    annualEquivalentLabel: "$79/mo billed annually",
    summary: "Connected inbox, advanced intelligence, and premium operations.",
    features: [
      "Everything in Standard",
      "Synced inbox and thread intelligence",
      "Email action items and discrepancy tracking",
      "Advanced analytics and future performance tooling"
    ]
  }
];

function formatTrialLabel(tier: PlanTier) {
  return tier === PlanTier.premium ? "7-day trial" : "14-day trial";
}

export function buildPlanAvailability() {
  return BILLING_PLAN_CATALOG.map((plan) => ({
    ...plan,
    monthlyAvailable: hasStripePriceId(plan.tier, BillingInterval.month),
    yearlyAvailable: hasStripePriceId(plan.tier, BillingInterval.year),
    trialLabel: formatTrialLabel(plan.tier)
  }));
}
