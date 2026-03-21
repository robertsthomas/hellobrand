import { BillingInterval, BillingSubscriptionStatus, PlanTier } from "@prisma/client";
import Stripe from "stripe";

import {
  getStripePriceId,
  getStripeSecretKey,
  hasStripePriceId
} from "@/lib/billing/config";

export type BillingPlanCatalogEntry = {
  tier: PlanTier;
  name: string;
  monthlyPriceLabel: string;
  annualPriceLabel: string;
  annualEquivalentLabel: string;
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
};

const BILLING_PLAN_CATALOG: BillingPlanCatalogEntry[] = [
  {
    tier: PlanTier.basic,
    name: "Basic",
    monthlyPriceLabel: "$19/mo",
    annualPriceLabel: "$180/yr",
    annualEquivalentLabel: "$15/mo billed annually",
    summary: "Core partnership intelligence for lighter creator workflows.",
    caption:
      "For creators getting started with active contract understanding and light operations",
    features: [
      "3 active workspaces",
      "AI extraction, summary, and risk review",
      "Basic deliverables and payment tracking",
      "AI assistant with capped usage"
    ],
    marketingFeatures: [
      "3 active partnership workspaces",
      "Document upload and paste intake",
      "AI extraction, summary, and risk review",
      "Editable partnership terms",
      "Basic deliverables and payments tracking",
      "Search and notifications",
      "AI assistant with monthly usage caps"
    ]
  },
  {
    tier: PlanTier.standard,
    name: "Standard",
    monthlyPriceLabel: "$49/mo",
    annualPriceLabel: "$468/yr",
    annualEquivalentLabel: "$39/mo billed annually",
    summary: "The full solo-creator workflow with deeper AI and workspace operations.",
    caption: "For active solo creators managing multiple brand partnerships",
    popular: true,
    features: [
      "Everything in Basic",
      "Unlimited active workspaces",
      "Full AI drafting and brief generation",
      "Revenue analytics and conflict intelligence"
    ],
    marketingFeatures: [
      "Everything in Basic",
      "Unlimited active partnership workspaces",
      "Full AI assistant access",
      "Negotiation and follow-up drafting",
      "AI campaign brief generation",
      "Cross-partnership conflict detection",
      "Full document diff review",
      "Full deliverables, approvals, and payment workflow"
    ]
  },
  {
    tier: PlanTier.premium,
    name: "Premium",
    monthlyPriceLabel: "$99/mo",
    annualPriceLabel: "$948/yr",
    annualEquivalentLabel: "$79/mo billed annually",
    summary: "Connected inbox, advanced intelligence, and premium operations.",
    caption:
      "For power creators, managers, or creator businesses that want HelloBrand as an operational system",
    features: [
      "Everything in Standard",
      "Synced inbox and thread intelligence",
      "Email action items and discrepancy tracking",
      "Advanced analytics and reporting"
    ],
    marketingFeatures: [
      "Everything in Standard",
      "Gmail / Outlook synced inbox",
      "Smart inbox matching and communication intelligence",
      "Action-item extraction from email",
      "Promise discrepancy detection",
      "Cross-partnership conflict surfacing from email",
      "Advanced analytics and reporting",
      "Priority support"
    ]
  }
];

function formatTrialLabel(tier: PlanTier) {
  return tier === PlanTier.premium ? "7-day trial" : "14-day trial";
}

function formatPriceAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

function formatRecurringLabel(unitAmount: number, currency: string, suffix: "mo" | "yr") {
  return `${formatPriceAmount(unitAmount, currency)}/${suffix}`;
}

function annualEquivalentFromYearly(unitAmount: number, currency: string) {
  const monthlyAmount = unitAmount / 12;
  return `${formatPriceAmount(monthlyAmount, currency)}/mo billed annually`;
}

async function fetchStripePriceDisplay(
  stripe: Stripe,
  plan: BillingPlanAvailability
) {
  if (!plan.monthlyAvailable) {
    return {
      displayMonthlyPriceLabel: plan.monthlyPriceLabel,
      displayAnnualEquivalentLabel: plan.yearlyAvailable
        ? plan.annualEquivalentLabel
        : "Monthly billing only right now"
    };
  }

  try {
    const monthlyPrice = await stripe.prices.retrieve(
      getStripePriceId(plan.tier, BillingInterval.month)
    );
    const monthlyUnitAmount =
      typeof monthlyPrice.unit_amount === "number" ? monthlyPrice.unit_amount / 100 : null;
    const currency = monthlyPrice.currency ?? "usd";
    const displayMonthlyPriceLabel =
      monthlyUnitAmount === null
        ? plan.monthlyPriceLabel
        : formatRecurringLabel(monthlyUnitAmount, currency, "mo");

    if (!plan.yearlyAvailable) {
      return {
        displayMonthlyPriceLabel,
        displayAnnualEquivalentLabel: "Monthly billing only right now"
      };
    }

    const yearlyPrice = await stripe.prices.retrieve(
      getStripePriceId(plan.tier, BillingInterval.year)
    );
    const yearlyUnitAmount =
      typeof yearlyPrice.unit_amount === "number" ? yearlyPrice.unit_amount / 100 : null;

    return {
      displayMonthlyPriceLabel,
      displayAnnualEquivalentLabel:
        yearlyUnitAmount === null
          ? plan.annualEquivalentLabel
          : annualEquivalentFromYearly(yearlyUnitAmount, yearlyPrice.currency ?? currency)
    };
  } catch {
    return {
      displayMonthlyPriceLabel: plan.monthlyPriceLabel,
      displayAnnualEquivalentLabel: plan.yearlyAvailable
        ? plan.annualEquivalentLabel
        : "Monthly billing only right now"
    };
  }
}

export function getPlanCatalogFeatures(tier: PlanTier): string[] {
  return BILLING_PLAN_CATALOG.find((p) => p.tier === tier)?.features ?? [];
}

export function buildPlanAvailability() {
  return BILLING_PLAN_CATALOG.map((plan) => ({
    ...plan,
    monthlyAvailable: hasStripePriceId(plan.tier, BillingInterval.month),
    yearlyAvailable: hasStripePriceId(plan.tier, BillingInterval.year),
    trialLabel: formatTrialLabel(plan.tier)
  }));
}

export async function buildMarketingPlanAvailability(): Promise<MarketingPlanAvailability[]> {
  const plans = buildPlanAvailability();
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    return plans.map((plan) => ({
      ...plan,
      displayMonthlyPriceLabel: plan.monthlyPriceLabel,
      displayAnnualEquivalentLabel: plan.yearlyAvailable
        ? plan.annualEquivalentLabel
        : "Monthly billing only right now"
    }));
  }

  const stripe = new Stripe(secretKey);
  return Promise.all(
    plans.map(async (plan) => ({
      ...plan,
      ...(await fetchStripePriceDisplay(stripe, plan))
    }))
  );
}
