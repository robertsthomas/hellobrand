import { PlanTier } from "@prisma/client";
import { afterEach, describe, expect, test } from "vitest";

import { buildBillingPageViewModel } from "@/app/app/settings/billing/page-helpers";
import { buildMarketingPlanAvailability, buildPlanAvailability } from "@/lib/billing/plans";

const originalEnv = {
  STRIPE_PRICE_BASIC_MONTHLY: process.env.STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY: process.env.STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
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

describe("billing page contract", () => {
  test("keeps billing usage cards aligned to workspaces, assistant, and briefs only", () => {
    const model = buildBillingPageViewModel({
      searchParams: {
        billing_error: "Example",
        billing_notice: "Heads up",
        checkout: "success",
      },
    });

    expect(model).toMatchObject({
      billingError: "Example",
      billingNotice: "Heads up",
      checkoutState: "success",
    });
    expect(model.usageCards).toEqual([
      { key: "active_workspaces", label: "Workspaces" },
      { key: "assistant_messages_monthly", label: "Assistant" },
      { key: "brief_generations_monthly", label: "Briefs" },
    ]);
  });

  test("keeps the public and billing plan catalog on Free, Basic, Premium", async () => {
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_basic_month";
    process.env.STRIPE_PRICE_BASIC_YEARLY = "price_basic_year";
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = "price_premium_month";
    process.env.STRIPE_PRICE_PREMIUM_YEARLY = "price_premium_year";

    const plans = buildPlanAvailability();
    const marketingPlans = await buildMarketingPlanAvailability();

    expect(plans.map((plan) => plan.tier)).toEqual([
      PlanTier.free,
      PlanTier.basic,
      PlanTier.premium,
    ]);
    expect(plans.map((plan) => plan.name)).toEqual(["Free", "Basic", "Premium"]);
    expect(plans.find((plan) => plan.tier === PlanTier.basic)?.popular).toBe(true);
    expect(plans.find((plan) => plan.tier === PlanTier.free)?.monthlyPriceUsd).toBe(0);
    expect(plans.find((plan) => plan.tier === PlanTier.basic)?.monthlyPriceUsd).toBe(29);
    expect(plans.find((plan) => plan.tier === PlanTier.premium)?.monthlyPriceUsd).toBe(79);

    expect(
      plans.find((plan) => plan.tier === PlanTier.free)?.features
    ).toContain("1 active workspace");
    expect(
      plans.find((plan) => plan.tier === PlanTier.basic)?.features
    ).toContain("8 active workspaces");
    expect(
      plans.find((plan) => plan.tier === PlanTier.premium)?.features
    ).toContain("Everything in Basic");

    expect(marketingPlans.map((plan) => plan.name)).toEqual(["Free", "Basic", "Premium"]);
    expect(
      marketingPlans.find((plan) => plan.tier === PlanTier.free)?.displayAnnualEquivalentLabel
    ).toBe("Free forever");
    expect(
      marketingPlans.find((plan) => plan.tier === PlanTier.basic)?.yearlyAvailable
    ).toBe(true);
    expect(
      marketingPlans.find((plan) => plan.tier === PlanTier.premium)?.yearlyAvailable
    ).toBe(true);
  });
});
