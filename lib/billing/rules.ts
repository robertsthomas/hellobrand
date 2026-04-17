import { BillingInterval, BillingSubscriptionStatus, PlanTier } from "@prisma/client";

const ACTIVE_BILLING_SUBSCRIPTION_STATUSES = new Set<BillingSubscriptionStatus>([
  BillingSubscriptionStatus.active,
  BillingSubscriptionStatus.trialing,
  BillingSubscriptionStatus.past_due,
  BillingSubscriptionStatus.paused
]);

type TrialOffer = {
  days: number;
  source: string;
};

type BillingTrialLedgerLike = {
  planTier: PlanTier;
};

type BillingAccountTrialStateLike = {
  currentPlanTier: PlanTier | null;
  currentSubscriptionStatus: BillingSubscriptionStatus | null;
  trialLedgers: BillingTrialLedgerLike[];
};

export function isActiveBillingSubscriptionStatus(
  status: BillingSubscriptionStatus | null | undefined
) {
  return Boolean(status && ACTIVE_BILLING_SUBSCRIPTION_STATUSES.has(status));
}

export function resolveEffectiveEntitlementTier(input: {
  overrideTier?: PlanTier | null;
  currentPlanTier?: PlanTier | null;
  currentTrialPlanTier?: PlanTier | null;
  currentSubscriptionStatus?: BillingSubscriptionStatus | null;
}) {
  if (input.overrideTier) {
    return input.overrideTier;
  }

  if (input.currentSubscriptionStatus === BillingSubscriptionStatus.trialing) {
    return input.currentTrialPlanTier ?? input.currentPlanTier ?? PlanTier.free;
  }

  return input.currentPlanTier ?? input.currentTrialPlanTier ?? PlanTier.free;
}

export function recommendedUpgradeForCurrentPlan(planTier: PlanTier | null) {
  if (!planTier) {
    return {
      tier: PlanTier.basic,
      label: "Start with Basic for the full creator workflow."
    };
  }

  if (planTier === PlanTier.free) {
    return {
      tier: PlanTier.basic,
      label: "Upgrade to Basic for more workspaces, briefs, analytics, and invoicing."
    };
  }

  if (planTier === PlanTier.basic) {
    return {
      tier: PlanTier.premium,
      label: "Upgrade to Premium for inbox intelligence, synced email, and advanced reporting."
    };
  }

  return {
    tier: null,
    label: null
  };
}

export function hasUsedTrialForPlan(
  trialLedgers: BillingTrialLedgerLike[] | null | undefined,
  planTier: PlanTier
) {
  return trialLedgers?.some((entry) => entry.planTier === planTier) ?? false;
}

export function getTrialOffer(
  billingAccount: BillingAccountTrialStateLike | null,
  planTier: PlanTier
): TrialOffer | null {
  if (hasUsedTrialForPlan(billingAccount?.trialLedgers, planTier)) {
    return null;
  }

  const isPremiumUpsell =
    planTier === PlanTier.premium &&
    billingAccount?.currentSubscriptionStatus === BillingSubscriptionStatus.active &&
    billingAccount.currentPlanTier === PlanTier.basic;

  if (isPremiumUpsell) {
    return {
      days: 14,
      source: "premium_paid_upsell"
    };
  }

  if (planTier === PlanTier.free) {
    return null;
  }

  return {
    days: planTier === PlanTier.premium ? 7 : 14,
    source: "new_plan_trial"
  };
}

export function intervalLabel(interval: BillingInterval) {
  return interval === BillingInterval.month ? "monthly" : "yearly";
}
