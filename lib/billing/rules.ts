import { BillingInterval, BillingSubscriptionStatus, PlanTier } from "@prisma/client";

export const ACTIVE_BILLING_SUBSCRIPTION_STATUSES = new Set<BillingSubscriptionStatus>([
  BillingSubscriptionStatus.active,
  BillingSubscriptionStatus.trialing,
  BillingSubscriptionStatus.past_due,
  BillingSubscriptionStatus.paused
]);

export type TrialOffer = {
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

export function recommendedUpgradeForCurrentPlan(planTier: PlanTier | null) {
  if (!planTier) {
    return {
      tier: PlanTier.standard,
      label: "Start with Standard for the full solo-creator workflow."
    };
  }

  if (planTier === PlanTier.basic) {
    return {
      tier: PlanTier.standard,
      label: "Upgrade to Standard for full AI drafting and broader workflow coverage."
    };
  }

  if (planTier === PlanTier.standard) {
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
    (billingAccount.currentPlanTier === PlanTier.basic ||
      billingAccount.currentPlanTier === PlanTier.standard);

  if (isPremiumUpsell) {
    return {
      days: 14,
      source: "premium_paid_upsell"
    };
  }

  return {
    days: planTier === PlanTier.premium ? 7 : 14,
    source: "new_plan_trial"
  };
}

export function intervalLabel(interval: BillingInterval) {
  return interval === BillingInterval.month ? "monthly" : "yearly";
}
