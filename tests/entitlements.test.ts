import { BillingSubscriptionStatus, PlanTier } from "@prisma/client";
import { describe, expect, test } from "vitest";

import { resolveEffectiveEntitlementTier } from "@/lib/billing/rules";

describe("resolveEffectiveEntitlementTier", () => {
  test("uses the trial tier while a trial is active", () => {
    expect(
      resolveEffectiveEntitlementTier({
        currentPlanTier: PlanTier.basic,
        currentTrialPlanTier: PlanTier.premium,
        currentSubscriptionStatus: BillingSubscriptionStatus.trialing
      })
    ).toBe(PlanTier.premium);
  });

  test("uses the current paid tier outside of trial status", () => {
    expect(
      resolveEffectiveEntitlementTier({
        currentPlanTier: PlanTier.basic,
        currentTrialPlanTier: PlanTier.premium,
        currentSubscriptionStatus: BillingSubscriptionStatus.active
      })
    ).toBe(PlanTier.basic);
  });

  test("keeps dev overrides highest priority", () => {
    expect(
      resolveEffectiveEntitlementTier({
        overrideTier: PlanTier.premium,
        currentPlanTier: PlanTier.free,
        currentTrialPlanTier: PlanTier.basic,
        currentSubscriptionStatus: BillingSubscriptionStatus.active
      })
    ).toBe(PlanTier.premium);
  });

  test("falls back to free when no paid plan or trial is active", () => {
    expect(
      resolveEffectiveEntitlementTier({
        currentPlanTier: null,
        currentTrialPlanTier: null,
        currentSubscriptionStatus: null
      })
    ).toBe(PlanTier.free);
  });
});
