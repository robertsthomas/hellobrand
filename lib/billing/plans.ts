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
    tier: PlanTier.basic,
    name: "Basic",
    persona: "Just starting out",
    monthlyPriceUsd: 19,
    annualPriceUsd: 180,
    monthlyPriceLabel: "$19/mo",
    annualPriceLabel: "$180/yr",
    annualEquivalentLabel: "$15/mo billed annually",
    annualSavingsLabel: "Save $48/yr",
    summary: "Core partnership intelligence for lighter creator workflows.",
    caption: "For creators getting started with active contract understanding and light operations",
    features: [
      "3 active workspaces",
      "AI extraction, summary, and risk review",
      "Basic deliverables and payment tracking",
      "AI assistant with capped usage",
      "Revenue tracking and basic analytics",
    ],
    marketingFeatures: [
      "3 active partnership workspaces",
      "25 AI assistant messages / month",
      "10 AI draft generations / month",
      "Document upload and paste intake",
      "AI extraction, summary, and risk review",
      "Editable partnership terms",
      "Basic deliverables and payments tracking",
      "Revenue tracking and basic analytics",
      "Search and notifications",
    ],
  },
  {
    tier: PlanTier.standard,
    name: "Standard",
    persona: "Active creator",
    monthlyPriceUsd: 49,
    annualPriceUsd: 468,
    monthlyPriceLabel: "$49/mo",
    annualPriceLabel: "$468/yr",
    annualEquivalentLabel: "$39/mo billed annually",
    annualSavingsLabel: "Save $120/yr",
    summary: "The full solo-creator workflow with deeper AI and workspace operations.",
    caption: "For active solo creators managing multiple brand partnerships",
    popular: true,
    features: [
      "Everything in Basic",
      "Unlimited active workspaces",
      "Full AI drafting and brief generation",
      "Revenue analytics and conflict intelligence",
    ],
    marketingFeatures: [
      "Everything in Basic",
      "Unlimited active partnership workspaces",
      "250 AI assistant messages / month",
      "100 AI draft generations / month",
      "30 AI campaign brief generations / month",
      "Negotiation and follow-up drafting",
      "Cross-partnership conflict detection",
      "Full document diff review",
      "Full deliverables, approvals, and payment workflow",
    ],
  },
  {
    tier: PlanTier.premium,
    name: "Premium",
    persona: "Power creator & managers",
    monthlyPriceUsd: 99,
    annualPriceUsd: 948,
    monthlyPriceLabel: "$99/mo",
    annualPriceLabel: "$948/yr",
    annualEquivalentLabel: "$79/mo billed annually",
    annualSavingsLabel: "Save $240/yr",
    summary: "Connected inbox, advanced intelligence, and premium operations.",
    caption:
      "For power creators, managers, or creator businesses that want HelloBrand as an operational system",
    features: [
      "Everything in Standard",
      "Synced inbox and thread intelligence",
      "Email action items and discrepancy tracking",
      "Advanced analytics and reporting",
    ],
    marketingFeatures: [
      "Everything in Standard",
      "Unlimited AI assistant, drafts, and briefs",
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
  return tier === PlanTier.premium ? "7-day trial" : "14-day trial";
}

export function getPlanCatalogFeatures(tier: PlanTier): string[] {
  return BILLING_PLAN_CATALOG.find((p) => p.tier === tier)?.features ?? [];
}

export function buildPlanAvailability() {
  return BILLING_PLAN_CATALOG.map((plan) => ({
    ...plan,
    monthlyAvailable: hasStripePriceId(plan.tier, BillingInterval.month),
    yearlyAvailable: hasStripePriceId(plan.tier, BillingInterval.year),
    trialLabel: formatTrialLabel(plan.tier),
  }));
}

export async function buildMarketingPlanAvailability(): Promise<MarketingPlanAvailability[]> {
  const plans = buildPlanAvailability();
  return plans.map((plan) => ({
    ...plan,
    displayMonthlyPriceLabel: plan.monthlyPriceLabel,
    displayAnnualEquivalentLabel: plan.yearlyAvailable
      ? plan.annualEquivalentLabel
      : "Monthly billing only right now",
  }));
}
