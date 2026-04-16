import { BillingInterval, BillingSubscriptionStatus, PlanTier } from "@prisma/client";

import { hasStripePriceId } from "@/lib/billing/config";

export type BillingPlanCatalogEntry = {
  tier: PlanTier;
  name: string;
  persona: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  monthlyPriceLabel: string;
  annualPriceLabel: string;
  annualEquivalentLabel: string;
  annualSavingsLabel: string;
  summary: string;
  caption: string;
  popular?: boolean;
  features: string[];
  marketingFeatures: string[];
};

export type BillingPlanAvailability = BillingPlanCatalogEntry & {
  monthlyAvailable: boolean;
  yearlyAvailable: boolean;
  trialLabel: string;
};

export type MarketingPlanAvailability = BillingPlanAvailability & {
  displayMonthlyPriceLabel: string;
  displayAnnualEquivalentLabel: string;
};

export type BillingInsights = {
  disclaimer: string;
  methodology: string;
  comparisonNotice: string | null;
  earningsCurrency: string | null;
  hasMixedCurrencies: boolean;
  trackedEarningsTotal: number | null;
  paidToDateTotal: number | null;
  outstandingTotal: number | null;
  currentMonthPaidTotal: number | null;
  yearToDatePaidTotal: number | null;
  monthlyPlanCostUsd: number;
  yearlyPlanCostUsd: number;
  currentMonthNetAfterPlanCostUsd: number | null;
  yearToDateNetAfterPlanCostUsd: number | null;
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
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  planCatalog: BillingPlanAvailability[];
  hasActiveSubscription: boolean;
  recommendedUpgradeTier: PlanTier | null;
  recommendedUpgradeLabel: string | null;
  insights: BillingInsights;
};

const BILLING_PLAN_CATALOG: BillingPlanCatalogEntry[] = [
  {
    tier: PlanTier.free,
    name: "Free",
    persona: "Trying one real deal",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    monthlyPriceLabel: "$0/mo",
    annualPriceLabel: "$0/yr",
    annualEquivalentLabel: "Free forever",
    annualSavingsLabel: "",
    summary: "Try HelloBrand on one active partnership before you decide to pay.",
    caption: "For creators validating value on one real brand partnership",
    features: [
      "1 active workspace",
      "AI extraction, summary, and risk review",
      "10 AI assistant messages / month",
      "No generated campaign briefs",
      "No analytics or inbox sync",
    ],
    marketingFeatures: [
      "1 active partnership workspace",
      "10 AI assistant messages / month",
      "Document upload and paste intake",
      "AI extraction, summary, and risk review",
      "Editable partnership terms",
      "Search and notifications",
    ],
  },
  {
    tier: PlanTier.basic,
    name: "Basic",
    persona: "Running creator ops",
    monthlyPriceUsd: 29,
    annualPriceUsd: 288,
    monthlyPriceLabel: "$29/mo",
    annualPriceLabel: "$288/yr",
    annualEquivalentLabel: "$24/mo billed annually",
    annualSavingsLabel: "Save $60/yr",
    summary: "The full paid creator workflow with generous limits for growing businesses.",
    caption: "For creators managing active brand work without needing a synced inbox yet",
    popular: true,
    features: [
      "8 active workspaces",
      "AI extraction, summary, and risk review",
      "Campaign brief generation",
      "Invoices, payment tracking, and analytics",
      "250 AI assistant messages / month",
    ],
    marketingFeatures: [
      "8 active partnership workspaces",
      "250 AI assistant messages / month",
      "20 AI campaign brief generations / month",
      "Document upload and paste intake",
      "AI extraction, summary, and risk review",
      "Editable partnership terms",
      "Full deliverables, invoicing, and payments workflow",
      "Revenue tracking and partnership analytics",
      "Cross-partnership conflict detection",
      "Search and notifications",
    ],
  },
  {
    tier: PlanTier.premium,
    name: "Premium",
    persona: "Operating at scale",
    monthlyPriceUsd: 79,
    annualPriceUsd: 768,
    monthlyPriceLabel: "$79/mo",
    annualPriceLabel: "$768/yr",
    annualEquivalentLabel: "$64/mo billed annually",
    annualSavingsLabel: "Save $180/yr",
    summary: "Connected inbox, advanced intelligence, and premium operations.",
    caption:
      "For power creators, managers, or creator businesses that want HelloBrand as an operational system",
    features: [
      "Everything in Basic",
      "Synced inbox and thread intelligence",
      "Email action items and discrepancy tracking",
      "Advanced analytics and reporting",
    ],
    marketingFeatures: [
      "Everything in Basic",
      "Unlimited active partnership workspaces",
      "Unlimited AI assistant and briefs",
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

function formatTrialLabel(tier: PlanTier) {
  if (tier === PlanTier.free) {
    return "Free forever";
  }

  return tier === PlanTier.premium ? "7-day trial" : "14-day trial";
}

export function getPlanCatalogFeatures(tier: PlanTier): string[] {
  return BILLING_PLAN_CATALOG.find((p) => p.tier === tier)?.features ?? [];
}

export function buildPlanAvailability() {
  return BILLING_PLAN_CATALOG.map((plan) => ({
    ...plan,
    monthlyAvailable:
      plan.tier === PlanTier.free || hasStripePriceId(plan.tier, BillingInterval.month),
    yearlyAvailable:
      plan.tier !== PlanTier.free && hasStripePriceId(plan.tier, BillingInterval.year),
    trialLabel: formatTrialLabel(plan.tier),
  }));
}

export async function buildMarketingPlanAvailability(): Promise<MarketingPlanAvailability[]> {
  const plans = buildPlanAvailability();
  return plans.map((plan) => ({
    ...plan,
    displayMonthlyPriceLabel: plan.monthlyPriceLabel,
    displayAnnualEquivalentLabel:
      plan.tier === PlanTier.free
        ? "Free forever"
        : plan.yearlyAvailable
          ? plan.annualEquivalentLabel
          : "Monthly billing only right now",
  }));
}
