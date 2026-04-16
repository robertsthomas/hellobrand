import { afterEach, describe, expect, test } from "vitest";
import { BillingInterval, BillingSubscriptionStatus, PlanTier } from "@prisma/client";

import { buildPlanAvailability } from "@/lib/billing/plans";
import {
  getTrialOffer,
  hasUsedTrialForPlan,
  intervalLabel,
  isActiveBillingSubscriptionStatus,
  recommendedUpgradeForCurrentPlan
} from "@/lib/billing/rules";

const originalEnv = {
  STRIPE_PRICE_BASIC_MONTHLY: process.env.STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY: process.env.STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY: process.env.STRIPE_PRICE_PREMIUM_YEARLY
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("billing rules", () => {
  test("recommends the next tier from the current plan", () => {
    expect(recommendedUpgradeForCurrentPlan(null)).toEqual({
      tier: PlanTier.basic,
      label: "Start with Basic for the full creator workflow."
    });
    expect(recommendedUpgradeForCurrentPlan(PlanTier.free)).toEqual({
      tier: PlanTier.basic,
      label: "Upgrade to Basic for more workspaces, briefs, analytics, and invoicing."
    });
    expect(recommendedUpgradeForCurrentPlan(PlanTier.basic).tier).toBe(PlanTier.premium);
    expect(recommendedUpgradeForCurrentPlan(PlanTier.premium)).toEqual({
      tier: null,
      label: null
    });
  });

  test("tracks whether a plan-specific trial was already used", () => {
    expect(
      hasUsedTrialForPlan(
        [{ planTier: PlanTier.basic }, { planTier: PlanTier.premium }],
        PlanTier.premium
      )
    ).toBe(true);
    expect(hasUsedTrialForPlan([{ planTier: PlanTier.basic }], PlanTier.free)).toBe(false);
  });

  test("returns default trial durations for fresh plan starts", () => {
    expect(getTrialOffer(null, PlanTier.free)).toBeNull();
    expect(getTrialOffer(null, PlanTier.basic)).toEqual({
      days: 14,
      source: "new_plan_trial"
    });
    expect(getTrialOffer(null, PlanTier.premium)).toEqual({
      days: 7,
      source: "new_plan_trial"
    });
  });

  test("returns premium upsell trials for active basic accounts", () => {
    expect(
      getTrialOffer(
        {
          currentPlanTier: PlanTier.basic,
          currentSubscriptionStatus: BillingSubscriptionStatus.active,
          trialLedgers: []
        },
        PlanTier.premium
      )
    ).toEqual({
      days: 14,
      source: "premium_paid_upsell"
    });
  });

  test("blocks repeated trials for the same plan", () => {
    expect(
      getTrialOffer(
        {
          currentPlanTier: PlanTier.basic,
          currentSubscriptionStatus: BillingSubscriptionStatus.active,
          trialLedgers: [{ planTier: PlanTier.premium }]
        },
        PlanTier.premium
      )
    ).toBeNull();
  });

  test("treats only active lifecycle statuses as self-serve subscription states", () => {
    expect(isActiveBillingSubscriptionStatus(BillingSubscriptionStatus.active)).toBe(true);
    expect(isActiveBillingSubscriptionStatus(BillingSubscriptionStatus.trialing)).toBe(true);
    expect(isActiveBillingSubscriptionStatus(BillingSubscriptionStatus.past_due)).toBe(true);
    expect(isActiveBillingSubscriptionStatus(BillingSubscriptionStatus.paused)).toBe(true);
    expect(isActiveBillingSubscriptionStatus(BillingSubscriptionStatus.canceled)).toBe(false);
    expect(isActiveBillingSubscriptionStatus(BillingSubscriptionStatus.incomplete)).toBe(false);
    expect(isActiveBillingSubscriptionStatus(null)).toBe(false);
  });

  test("labels billing intervals consistently", () => {
    expect(intervalLabel(BillingInterval.month)).toBe("monthly");
    expect(intervalLabel(BillingInterval.year)).toBe("yearly");
  });
});

describe("billing plan availability", () => {
  test("reads monthly and yearly Stripe price availability from env", () => {
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_basic_month";
    delete process.env.STRIPE_PRICE_BASIC_YEARLY;
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = "price_premium_month";
    delete process.env.STRIPE_PRICE_PREMIUM_YEARLY;

    const plans = buildPlanAvailability();
    const free = plans.find((plan) => plan.tier === PlanTier.free);
    const basic = plans.find((plan) => plan.tier === PlanTier.basic);
    const premium = plans.find((plan) => plan.tier === PlanTier.premium);

    expect(free?.monthlyAvailable).toBe(true);
    expect(free?.yearlyAvailable).toBe(false);
    expect(free?.trialLabel).toBe("Free forever");

    expect(basic?.monthlyAvailable).toBe(true);
    expect(basic?.yearlyAvailable).toBe(false);
    expect(basic?.trialLabel).toBe("14-day trial");

    expect(premium?.monthlyAvailable).toBe(true);
    expect(premium?.yearlyAvailable).toBe(false);
    expect(premium?.trialLabel).toBe("7-day trial");
  });
});
