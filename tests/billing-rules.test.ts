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
  STRIPE_PRICE_STANDARD_MONTHLY: process.env.STRIPE_PRICE_STANDARD_MONTHLY,
  STRIPE_PRICE_STANDARD_YEARLY: process.env.STRIPE_PRICE_STANDARD_YEARLY,
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
      tier: PlanTier.standard,
      label: "Start with Standard for the full solo-creator workflow."
    });
    expect(recommendedUpgradeForCurrentPlan(PlanTier.basic).tier).toBe(PlanTier.standard);
    expect(recommendedUpgradeForCurrentPlan(PlanTier.standard).tier).toBe(PlanTier.premium);
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
    expect(hasUsedTrialForPlan([{ planTier: PlanTier.basic }], PlanTier.standard)).toBe(
      false
    );
  });

  test("returns default trial durations for fresh plan starts", () => {
    expect(getTrialOffer(null, PlanTier.basic)).toEqual({
      days: 14,
      source: "new_plan_trial"
    });
    expect(getTrialOffer(null, PlanTier.standard)).toEqual({
      days: 14,
      source: "new_plan_trial"
    });
    expect(getTrialOffer(null, PlanTier.premium)).toEqual({
      days: 7,
      source: "new_plan_trial"
    });
  });

  test("returns premium upsell trials for active paid basic and standard accounts", () => {
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

    expect(
      getTrialOffer(
        {
          currentPlanTier: PlanTier.standard,
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
          currentPlanTier: PlanTier.standard,
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
    process.env.STRIPE_PRICE_STANDARD_MONTHLY = "price_standard_month";
    process.env.STRIPE_PRICE_STANDARD_YEARLY = "price_standard_year";
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = "price_premium_month";
    delete process.env.STRIPE_PRICE_PREMIUM_YEARLY;

    const plans = buildPlanAvailability();
    const basic = plans.find((plan) => plan.tier === PlanTier.basic);
    const standard = plans.find((plan) => plan.tier === PlanTier.standard);
    const premium = plans.find((plan) => plan.tier === PlanTier.premium);

    expect(basic?.monthlyAvailable).toBe(true);
    expect(basic?.yearlyAvailable).toBe(false);
    expect(basic?.trialLabel).toBe("14-day trial");

    expect(standard?.monthlyAvailable).toBe(true);
    expect(standard?.yearlyAvailable).toBe(true);
    expect(standard?.trialLabel).toBe("14-day trial");

    expect(premium?.monthlyAvailable).toBe(true);
    expect(premium?.yearlyAvailable).toBe(false);
    expect(premium?.trialLabel).toBe("7-day trial");
  });
});
