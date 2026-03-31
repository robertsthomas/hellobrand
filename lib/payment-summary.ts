import type { PaymentStatus } from "@/lib/types";

type PaymentLike = {
  amount: number | null;
  currency: string | null;
  status: PaymentStatus;
};

type PaymentRowLike = {
  payment: PaymentLike;
};

export type CurrencyBreakdown = {
  currency: string;
  amount: number;
};

export type PaymentSummaryAmount = {
  total: number | null;
  currency: string | null;
  hasMixedCurrencies: boolean;
  breakdown: CurrencyBreakdown[];
};

export type PaymentPageSummary = {
  tracked: PaymentSummaryAmount;
  outstanding: PaymentSummaryAmount;
  late: PaymentSummaryAmount;
};

function normalizeCurrency(currency: string | null) {
  return (currency ?? "USD").toUpperCase();
}

function buildSummaryAmount(amountsByCurrency: Map<string, number>): PaymentSummaryAmount {
  const breakdown = Array.from(amountsByCurrency.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => left.currency.localeCompare(right.currency));

  if (breakdown.length === 0) {
    return {
      total: 0,
      currency: "USD",
      hasMixedCurrencies: false,
      breakdown: []
    };
  }

  if (breakdown.length === 1) {
    return {
      total: breakdown[0]?.amount ?? 0,
      currency: breakdown[0]?.currency ?? "USD",
      hasMixedCurrencies: false,
      breakdown
    };
  }

  return {
    total: null,
    currency: null,
    hasMixedCurrencies: true,
    breakdown
  };
}

function addAmount(amountsByCurrency: Map<string, number>, payment: PaymentLike) {
  if (payment.amount === null || Number.isNaN(payment.amount)) {
    return;
  }

  const currency = normalizeCurrency(payment.currency);
  amountsByCurrency.set(currency, (amountsByCurrency.get(currency) ?? 0) + payment.amount);
}

export function summarizePaymentRows(rows: PaymentRowLike[]): PaymentPageSummary {
  const tracked = new Map<string, number>();
  const outstanding = new Map<string, number>();
  const late = new Map<string, number>();

  for (const row of rows) {
    addAmount(tracked, row.payment);

    if (["awaiting_payment", "late"].includes(row.payment.status)) {
      addAmount(outstanding, row.payment);
    }

    if (row.payment.status === "late") {
      addAmount(late, row.payment);
    }
  }

  return {
    tracked: buildSummaryAmount(tracked),
    outstanding: buildSummaryAmount(outstanding),
    late: buildSummaryAmount(late)
  };
}
