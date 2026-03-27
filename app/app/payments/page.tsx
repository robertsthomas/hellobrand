import Link from "next/link";
import { Suspense } from "react";

import { PaymentsSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { getCachedDealAggregates } from "@/lib/cached-data";
import { summarizePaymentRows, type PaymentSummaryAmount } from "@/lib/payment-summary";
import { formatCurrency } from "@/lib/utils";

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

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PaymentsSkeleton />}>
      <PaymentsContent />
    </Suspense>
  );
}

async function PaymentsContent() {
  const viewer = await requireViewer();
  const aggregates = await getCachedDealAggregates(viewer);
  const rows = aggregates.map((aggregate) => ({
    deal: aggregate.deal,
    invoice: aggregate.invoiceRecord ?? null,
    invoiceDocuments: aggregate.documents.filter((document) => document.documentKind === "invoice"),
    payment:
      aggregate.paymentRecord ?? {
        id: `payment-${aggregate.deal.id}`,
        dealId: aggregate.deal.id,
        amount: aggregate.terms?.paymentAmount ?? null,
        currency: aggregate.terms?.currency ?? "USD",
        invoiceDate: null,
        dueDate: null,
        paidDate: null,
        status: aggregate.deal.paymentStatus,
        notes: null,
        source: null,
        createdAt: aggregate.deal.createdAt,
        updatedAt: aggregate.deal.updatedAt
      }
  }));
  const summary = summarizePaymentRows(rows);

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-8">
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

          <div className="grid gap-6 border-t border-black/8 pt-5 sm:grid-cols-3">
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

        {rows.length === 0 ? (
          <div className="border-t border-dashed border-black/10 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[34px]">
              No payments tracked yet
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              Upload documents from the intake flow and confirm a workspace to
              start tracking payout details here.
            </p>
            <Link href="/app/intake/new" className="mt-6 inline-flex bg-primary px-5 py-3 text-sm font-semibold text-white">
              Start a workspace
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="hidden gap-4 border border-black/8 bg-[#f8f8f6] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3] md:grid md:grid-cols-[minmax(0,1.5fr)_140px_150px_130px_120px]">
              <span>Workspace</span>
              <span>Payment status</span>
              <span>Invoice</span>
              <span>Due</span>
              <span>Total</span>
            </div>

            <div className="border-t border-black/8">
              {rows.map(({ deal, payment, invoice, invoiceDocuments }) => {
                const invoiceState =
                  invoiceDocuments.length > 0
                    ? "Invoice attached"
                    : invoice
                      ? "Draft invoice"
                      : "No invoice";

                return (
                  <Link
                    key={deal.id}
                    href={`/app/payments/${deal.id}`}
                    className="grid gap-4 border-b border-black/8 bg-white px-4 py-6 transition hover:bg-[#fbfbfa] md:grid-cols-[minmax(0,1.5fr)_140px_150px_130px_120px]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                        {deal.brandName}
                      </p>
                      <h2 className="mt-2 truncate text-[24px] font-semibold tracking-[-0.04em] text-foreground">
                        {deal.campaignName}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {invoice?.invoiceNumber ?? "Open workspace payment"}
                      </p>
                    </div>

                    <div className="text-sm text-foreground">
                      {payment.status.replaceAll("_", " ")}
                    </div>
                    <div className="text-sm text-foreground">{invoiceState}</div>
                    <div className="text-sm text-foreground">
                      {payment.dueDate ? payment.dueDate.slice(0, 10) : "Not set"}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatCurrency(payment.amount, payment.currency ?? "USD")}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
