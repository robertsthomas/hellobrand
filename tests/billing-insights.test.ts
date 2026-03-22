import { BillingInterval, PlanTier } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeBillingInsights, type BillingInsightPayment } from "@/lib/billing/insights";
import { buildPlanAvailability } from "@/lib/billing/plans";

function makePayment(overrides: Partial<BillingInsightPayment> = {}): BillingInsightPayment {
  return {
    amount: 1000,
    currency: "USD",
    status: "paid",
    paidDate: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...overrides
  };
}

describe("computeBillingInsights", () => {
  it("computes paid, outstanding, and net comparisons for a USD monthly plan", () => {
    const insights = computeBillingInsights({
      currentPlanTier: PlanTier.standard,
      currentPlanInterval: BillingInterval.month,
      planCatalog: buildPlanAvailability(),
      payments: [
        makePayment({ amount: 900, paidDate: "2026-03-04T00:00:00.000Z" }),
        makePayment({ amount: 600, paidDate: "2026-01-18T00:00:00.000Z" }),
        makePayment({ amount: 250, status: "awaiting_payment", paidDate: null })
      ],
      now: new Date("2026-03-21T00:00:00.000Z")
    });

    expect(insights.earningsCurrency).toBe("USD");
    expect(insights.hasMixedCurrencies).toBe(false);
    expect(insights.paidToDateTotal).toBe(1500);
    expect(insights.outstandingTotal).toBe(250);
    expect(insights.currentMonthPaidTotal).toBe(900);
    expect(insights.yearToDatePaidTotal).toBe(1500);
    expect(insights.monthlyPlanCostUsd).toBe(49);
    expect(insights.yearlyPlanCostUsd).toBe(588);
    expect(insights.currentMonthNetAfterPlanCostUsd).toBe(851);
    expect(insights.yearToDateNetAfterPlanCostUsd).toBe(912);
    expect(insights.comparisonNotice).toBeNull();
  });

  it("hides net comparisons for non-USD earnings", () => {
    const insights = computeBillingInsights({
      currentPlanTier: PlanTier.basic,
      currentPlanInterval: BillingInterval.month,
      planCatalog: buildPlanAvailability(),
      payments: [makePayment({ amount: 1200, currency: "GBP" })],
      now: new Date("2026-03-21T00:00:00.000Z")
    });

    expect(insights.earningsCurrency).toBe("GBP");
    expect(insights.paidToDateTotal).toBe(1200);
    expect(insights.currentMonthNetAfterPlanCostUsd).toBeNull();
    expect(insights.yearToDateNetAfterPlanCostUsd).toBeNull();
    expect(insights.comparisonNotice).toContain("GBP");
  });

  it("hides earnings totals when multiple currencies are tracked", () => {
    const insights = computeBillingInsights({
      currentPlanTier: PlanTier.premium,
      currentPlanInterval: BillingInterval.year,
      planCatalog: buildPlanAvailability(),
      payments: [
        makePayment({ amount: 1200, currency: "USD" }),
        makePayment({ amount: 800, currency: "EUR" })
      ],
      now: new Date("2026-03-21T00:00:00.000Z")
    });

    expect(insights.hasMixedCurrencies).toBe(true);
    expect(insights.trackedEarningsTotal).toBeNull();
    expect(insights.paidToDateTotal).toBeNull();
    expect(insights.outstandingTotal).toBeNull();
    expect(insights.currentMonthNetAfterPlanCostUsd).toBeNull();
    expect(insights.comparisonNotice).toContain("multiple currencies");
  });

  it("treats the absence of a paid plan as zero HelloBrand cost", () => {
    const insights = computeBillingInsights({
      currentPlanTier: null,
      currentPlanInterval: null,
      planCatalog: buildPlanAvailability(),
      payments: [makePayment({ amount: 400 })],
      now: new Date("2026-03-21T00:00:00.000Z")
    });

    expect(insights.monthlyPlanCostUsd).toBe(0);
    expect(insights.yearlyPlanCostUsd).toBe(0);
    expect(insights.currentMonthNetAfterPlanCostUsd).toBe(400);
    expect(insights.yearToDateNetAfterPlanCostUsd).toBe(400);
  });
});
