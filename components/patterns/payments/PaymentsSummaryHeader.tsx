import { formatCurrency } from "@/lib/utils";
import type { PaymentSummaryAmount } from "@/lib/payment-summary";

function SummaryValue({ summary }: { summary: PaymentSummaryAmount }) {
  if (!summary.hasMixedCurrencies) {
    return (
      <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[32px]">
        {formatCurrency(summary.total, summary.currency ?? "USD")}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xl font-semibold tracking-[-0.05em] text-foreground sm:text-[24px]">
        Mixed
      </p>
      <p className="text-xs text-muted-foreground">
        {summary.breakdown
          .map((entry) => formatCurrency(entry.amount, entry.currency))
          .join(" · ")}
      </p>
    </div>
  );
}

export function PaymentsSummaryHeader({
  summary,
}: {
  summary: {
    tracked: PaymentSummaryAmount;
    outstanding: PaymentSummaryAmount;
    late: PaymentSummaryAmount;
  };
}) {
  return (
    <section className="space-y-6 border-b border-black/8 pb-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
          Payments
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-foreground sm:text-[44px]">
          Payments
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
          Track every workspace payment in one place, see whether an invoice exists,
          and open each workspace for the full payment split and attachment details.
        </p>
      </div>

      <div data-guide="payments-summary" className="grid gap-6 border-t border-black/8 pt-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
            Tracked
          </p>
          <SummaryValue summary={summary.tracked} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
            Outstanding
          </p>
          <SummaryValue summary={summary.outstanding} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
            Late
          </p>
          <SummaryValue summary={summary.late} />
        </div>
      </div>
    </section>
  );
}
