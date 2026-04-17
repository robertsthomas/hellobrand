import { BillingInterval, PlanTier } from "@prisma/client";

import type { BillingInsights, BillingPlanAvailability } from "@/lib/billing/plans";

export type BillingInsightPayment = {
  amount: number | null;
  currency: string | null;
  status: string;
  paidDate: string | null;
  updatedAt: string;
};

type BillingInsightsInput = {
  currentPlanTier: PlanTier | null;
  currentPlanInterval: BillingInterval | null;
  planCatalog: BillingPlanAvailability[];
  payments: BillingInsightPayment[];
  now?: Date;
};

function isPaid(status: string) {
  return status === "paid";
}

function isOutstanding(status: string) {
  return status === "awaiting_payment" || status === "late";
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function resolvePlanCosts(
  planCatalog: BillingPlanAvailability[],
  currentPlanTier: PlanTier | null,
  currentPlanInterval: BillingInterval | null
) {
  if (!currentPlanTier) {
    return {
      monthlyPlanCostUsd: 0,
      yearlyPlanCostUsd: 0
    };
  }

  const plan = planCatalog.find((entry) => entry.tier === currentPlanTier);
  if (!plan) {
    return {
      monthlyPlanCostUsd: 0,
      yearlyPlanCostUsd: 0
    };
  }

  if (currentPlanInterval === BillingInterval.year) {
    return {
      monthlyPlanCostUsd: Math.round((plan.annualPriceUsd / 12) * 100) / 100,
      yearlyPlanCostUsd: plan.annualPriceUsd
    };
  }

  return {
    monthlyPlanCostUsd: plan.monthlyPriceUsd,
    yearlyPlanCostUsd: plan.monthlyPriceUsd * 12
  };
}

function resolveTrackedCurrency(payments: BillingInsightPayment[]) {
  const currencies = Array.from(
    new Set(
      payments
        .filter((payment) => payment.amount !== null)
        .map((payment) => (payment.currency ?? "USD").toUpperCase())
    )
  );

  if (currencies.length === 0) {
    return {
      earningsCurrency: "USD",
      hasMixedCurrencies: false
    };
  }

  if (currencies.length === 1) {
    return {
      earningsCurrency: currencies[0],
      hasMixedCurrencies: false
    };
  }

  return {
    earningsCurrency: null,
    hasMixedCurrencies: true
  };
}

function safeDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

// fallow-ignore-next-line complexity
export function computeBillingInsights({
  currentPlanTier,
  currentPlanInterval,
  planCatalog,
  payments,
  now = new Date()
}: BillingInsightsInput): BillingInsights {
  const { monthlyPlanCostUsd, yearlyPlanCostUsd } = resolvePlanCosts(
    planCatalog,
    currentPlanTier,
    currentPlanInterval
  );
  const { earningsCurrency, hasMixedCurrencies } = resolveTrackedCurrency(payments);

  const base: BillingInsights = {
    disclaimer:
      "Informational only. HelloBrand does not provide certified tax, accounting, or bookkeeping advice.",
    methodology:
      "Brand earnings are based on tracked payment records. Month and year figures use the payment date when available and otherwise fall back to the latest record update for paid items.",
    comparisonNotice: null,
    earningsCurrency,
    hasMixedCurrencies,
    trackedEarningsTotal: 0,
    paidToDateTotal: 0,
    outstandingTotal: 0,
    currentMonthPaidTotal: 0,
    yearToDatePaidTotal: 0,
    monthlyPlanCostUsd,
    yearlyPlanCostUsd,
    currentMonthNetAfterPlanCostUsd: null,
    yearToDateNetAfterPlanCostUsd: null
  };

  if (hasMixedCurrencies) {
    return {
      ...base,
      trackedEarningsTotal: null,
      paidToDateTotal: null,
      outstandingTotal: null,
      currentMonthPaidTotal: null,
      yearToDatePaidTotal: null,
      comparisonNotice:
        "Net comparisons are hidden because your tracked deal payments span multiple currencies."
    };
  }

  const monthStart = startOfMonth(now).getTime();
  const yearStart = startOfYear(now).getTime();

  let trackedEarningsTotal = 0;
  let paidToDateTotal = 0;
  let outstandingTotal = 0;
  let currentMonthPaidTotal = 0;
  let yearToDatePaidTotal = 0;

  for (const payment of payments) {
    if (payment.amount === null) {
      continue;
    }

    trackedEarningsTotal += payment.amount;

    if (isOutstanding(payment.status)) {
      outstandingTotal += payment.amount;
    }

    if (!isPaid(payment.status)) {
      continue;
    }

    paidToDateTotal += payment.amount;

    const paidAt = safeDate(payment.paidDate) ?? safeDate(payment.updatedAt);
    if (!paidAt) {
      continue;
    }

    const paidAtMs = paidAt.getTime();
    if (paidAtMs >= monthStart) {
      currentMonthPaidTotal += payment.amount;
    }
    if (paidAtMs >= yearStart) {
      yearToDatePaidTotal += payment.amount;
    }
  }

  const comparisonNotice =
    earningsCurrency && earningsCurrency !== "USD"
      ? `Net comparisons are hidden because your tracked deal payments are in ${earningsCurrency} while HelloBrand pricing is shown in USD.`
      : null;

  return {
    ...base,
    trackedEarningsTotal,
    paidToDateTotal,
    outstandingTotal,
    currentMonthPaidTotal,
    yearToDatePaidTotal,
    comparisonNotice,
    currentMonthNetAfterPlanCostUsd:
      comparisonNotice === null ? currentMonthPaidTotal - monthlyPlanCostUsd : null,
    yearToDateNetAfterPlanCostUsd:
      comparisonNotice === null ? yearToDatePaidTotal - yearlyPlanCostUsd : null
  };
}
