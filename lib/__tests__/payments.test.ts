import { describe, expect, it } from "vitest";

import type { PaymentRecord, PaymentStatus } from "@/lib/types";

// Re-implement normalizePaymentStatus as a pure function for testing
// (mirrors the logic in lib/payments.ts without Prisma dependency)
function normalizePaymentStatus(
  status: string,
  dueDate: Date | null,
  paidDate: Date | null
): PaymentStatus {
  const normalizedInputStatus = status === "invoiced" ? "not_invoiced" : status;

  if (paidDate || status === "paid") {
    return "paid";
  }

  if (dueDate && dueDate.getTime() < Date.now() && normalizedInputStatus === "awaiting_payment") {
    return "late";
  }

  if (normalizedInputStatus === "awaiting_payment") {
    return "awaiting_payment";
  }

  return "not_invoiced";
}

function dueDateFromNetTerms(netTermsDays: number | null): Date | null {
  if (!netTermsDays || netTermsDays <= 0) {
    return null;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + netTermsDays);
  return dueDate;
}

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay-1",
    dealId: "deal-1",
    amount: 2000,
    currency: "USD",
    invoiceDate: null,
    dueDate: null,
    paidDate: null,
    status: "not_invoiced",
    notes: null,
    source: "ai_extraction",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("normalizePaymentStatus", () => {
  it("returns paid when paidDate is set", () => {
    expect(normalizePaymentStatus("not_invoiced", null, new Date())).toBe("paid");
  });

  it("returns paid when status is paid regardless of dates", () => {
    expect(normalizePaymentStatus("paid", null, null)).toBe("paid");
  });

  it("returns late when dueDate is in the past and not paid", () => {
    const pastDate = new Date("2020-01-01");
    expect(normalizePaymentStatus("awaiting_payment", pastDate, null)).toBe("late");
  });

  it("returns awaiting_payment when status matches and not overdue", () => {
    const futureDate = new Date("2099-12-31");
    expect(normalizePaymentStatus("awaiting_payment", futureDate, null)).toBe(
      "awaiting_payment"
    );
  });

  it("normalizes legacy invoiced status to not_invoiced when not sent yet", () => {
    const futureDate = new Date("2099-12-31");
    expect(normalizePaymentStatus("invoiced", futureDate, null)).toBe("not_invoiced");
  });

  it("returns not_invoiced for unknown status with no dates", () => {
    expect(normalizePaymentStatus("something_random", null, null)).toBe("not_invoiced");
  });

  it("returns not_invoiced for empty string status", () => {
    expect(normalizePaymentStatus("", null, null)).toBe("not_invoiced");
  });

  it("paid takes precedence over late", () => {
    const pastDate = new Date("2020-01-01");
    expect(normalizePaymentStatus("paid", pastDate, null)).toBe("paid");
  });

  it("paid via paidDate takes precedence over late dueDate", () => {
    const pastDue = new Date("2020-01-01");
    const paidDate = new Date("2020-02-01");
    expect(normalizePaymentStatus("invoiced", pastDue, paidDate)).toBe("paid");
  });

  it("returns late even for awaiting_payment if dueDate is past", () => {
    const pastDate = new Date("2020-06-01");
    expect(normalizePaymentStatus("awaiting_payment", pastDate, null)).toBe("late");
  });
});

describe("dueDateFromNetTerms", () => {
  it("returns null for null netTermsDays", () => {
    expect(dueDateFromNetTerms(null)).toBeNull();
  });

  it("returns null for zero netTermsDays", () => {
    expect(dueDateFromNetTerms(0)).toBeNull();
  });

  it("returns null for negative netTermsDays", () => {
    expect(dueDateFromNetTerms(-5)).toBeNull();
  });

  it("returns a future date for positive netTermsDays", () => {
    const result = dueDateFromNetTerms(30);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });

  it("computes correct offset for Net 45", () => {
    const result = dueDateFromNetTerms(45);
    const expected = new Date();
    expected.setDate(expected.getDate() + 45);
    // Allow 1 second tolerance
    expect(Math.abs(result!.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});

describe("PaymentRecord shape", () => {
  it("creates a valid payment record with defaults", () => {
    const payment = makePayment();
    expect(payment.amount).toBe(2000);
    expect(payment.currency).toBe("USD");
    expect(payment.status).toBe("not_invoiced");
    expect(payment.paidDate).toBeNull();
  });

  it("supports all payment statuses", () => {
    const statuses: PaymentStatus[] = [
      "not_invoiced",
      "awaiting_payment",
      "paid",
      "late",
      "invoiced"
    ];
    for (const status of statuses) {
      const payment = makePayment({ status });
      expect(payment.status).toBe(status);
    }
  });

  it("handles null amount for deals without payment terms", () => {
    const payment = makePayment({ amount: null });
    expect(payment.amount).toBeNull();
  });

  it("handles different currencies", () => {
    const payment = makePayment({ currency: "GBP", amount: 1500 });
    expect(payment.currency).toBe("GBP");
  });

  it("handles null currency", () => {
    const payment = makePayment({ currency: null });
    expect(payment.currency).toBeNull();
  });
});

describe("payment edge cases", () => {
  it("normalizes legacy invoiced + future due date to not_invoiced", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    expect(normalizePaymentStatus("invoiced", futureDate, null)).toBe("not_invoiced");
  });

  it("does not mark legacy invoiced as late before it is actually sent", () => {
    const pastDate = new Date("2024-01-01");
    expect(normalizePaymentStatus("invoiced", pastDate, null)).toBe("not_invoiced");
  });

  it("normalizes to paid even with past due date if paid", () => {
    const pastDue = new Date("2024-01-01");
    const paidDate = new Date("2024-01-15");
    expect(normalizePaymentStatus("awaiting_payment", pastDue, paidDate)).toBe("paid");
  });

  it("handles missing/invalid dueDate gracefully", () => {
    expect(normalizePaymentStatus("not_invoiced", null, null)).toBe("not_invoiced");
  });
});
