import { describe, expect, it } from "vitest";

import { summarizePaymentRows } from "@/lib/payment-summary";
import type { PaymentStatus } from "@/lib/types";

function makeRow({
  amount,
  currency = "USD",
  status = "not_invoiced"
}: {
  amount: number | null;
  currency?: string | null;
  status?: PaymentStatus;
}) {
  return {
    payment: {
      amount,
      currency,
      status
    }
  };
}

describe("summarizePaymentRows", () => {
  it("returns single-currency totals when all tracked payments match", () => {
    const summary = summarizePaymentRows([
      makeRow({ amount: 1500, status: "invoiced" }),
      makeRow({ amount: 500, status: "paid" }),
      makeRow({ amount: 250, status: "late" })
    ]);

    expect(summary.tracked).toEqual({
      total: 2250,
      currency: "USD",
      hasMixedCurrencies: false,
      breakdown: [{ currency: "USD", amount: 2250 }]
    });
    expect(summary.outstanding).toEqual({
      total: 1750,
      currency: "USD",
      hasMixedCurrencies: false,
      breakdown: [{ currency: "USD", amount: 1750 }]
    });
    expect(summary.late).toEqual({
      total: 250,
      currency: "USD",
      hasMixedCurrencies: false,
      breakdown: [{ currency: "USD", amount: 250 }]
    });
  });

  it("keeps a currency breakdown instead of fabricating a mixed total", () => {
    const summary = summarizePaymentRows([
      makeRow({ amount: 1000, currency: "usd", status: "invoiced" }),
      makeRow({ amount: 800, currency: "EUR", status: "awaiting_payment" }),
      makeRow({ amount: 300, currency: "GBP", status: "paid" })
    ]);

    expect(summary.tracked.total).toBeNull();
    expect(summary.tracked.currency).toBeNull();
    expect(summary.tracked.hasMixedCurrencies).toBe(true);
    expect(summary.tracked.breakdown).toEqual([
      { currency: "EUR", amount: 800 },
      { currency: "GBP", amount: 300 },
      { currency: "USD", amount: 1000 }
    ]);

    expect(summary.outstanding.total).toBeNull();
    expect(summary.outstanding.hasMixedCurrencies).toBe(true);
    expect(summary.outstanding.breakdown).toEqual([
      { currency: "EUR", amount: 800 },
      { currency: "USD", amount: 1000 }
    ]);
  });

  it("defaults empty and null-currency rows safely", () => {
    const summary = summarizePaymentRows([
      makeRow({ amount: null, status: "paid" }),
      makeRow({ amount: 0, currency: null, status: "not_invoiced" })
    ]);

    expect(summary.tracked).toEqual({
      total: 0,
      currency: "USD",
      hasMixedCurrencies: false,
      breakdown: [{ currency: "USD", amount: 0 }]
    });
    expect(summary.outstanding).toEqual({
      total: 0,
      currency: "USD",
      hasMixedCurrencies: false,
      breakdown: []
    });
    expect(summary.late).toEqual({
      total: 0,
      currency: "USD",
      hasMixedCurrencies: false,
      breakdown: []
    });
  });
});
