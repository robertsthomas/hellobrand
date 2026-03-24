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
        currentPlanTier: PlanTier.standard,
        currentTrialPlanTier: PlanTier.premium,
        currentSubscriptionStatus: BillingSubscriptionStatus.active
      })
    ).toBe(PlanTier.standard);
  });

  test("keeps dev overrides highest priority", () => {
    expect(
      resolveEffectiveEntitlementTier({
        overrideTier: PlanTier.premium,
        currentPlanTier: PlanTier.basic,
        currentTrialPlanTier: PlanTier.standard,
        currentSubscriptionStatus: BillingSubscriptionStatus.active
      })
    ).toBe(PlanTier.premium);
  });
});
