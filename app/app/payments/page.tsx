import Link from "next/link";
import { Suspense } from "react";

import { savePaymentAction } from "@/app/actions";
import { PaymentsSkeleton } from "@/components/skeletons";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth";
import { getCachedPayments } from "@/lib/cached-data";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";


function paymentBadgeClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  }

  if (status === "late") {
    return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50";
  }

  if (status === "awaiting_payment" || status === "invoiced") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] hover:bg-[#f5f6f8]";
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
  const rows = await getCachedPayments(viewer);

  const totals = rows.reduce(
    (accumulator, row) => {
      const amount = row.payment.amount ?? 0;
      accumulator.total += amount;

      if (["invoiced", "awaiting_payment", "late"].includes(row.payment.status)) {
        accumulator.outstanding += amount;
      }

      if (row.payment.status === "late") {
        accumulator.late += amount;
      }

      return accumulator;
    },
    { total: 0, outstanding: 0, late: 0 }
  );

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <section className="space-y-6 border-b border-black/8 pb-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
              Payments
            </p>
            <h1 className="mt-3 text-[44px] font-semibold tracking-[-0.06em] text-foreground">
              Payments
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Track payout status, update due dates, and keep invoice notes in
              one cleaner finance view for each workspace.
            </p>
          </div>

          <div className="grid gap-6 border-t border-black/8 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                Tracked
              </p>
              <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-foreground">
                {formatCurrency(totals.total)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                Outstanding
              </p>
              <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-foreground">
                {formatCurrency(totals.outstanding)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                Late
              </p>
              <p className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-foreground">
                {formatCurrency(totals.late)}
              </p>
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="border-t border-dashed border-black/10 py-16 text-center">
            <h2 className="text-[34px] font-semibold tracking-[-0.05em] text-foreground">
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
          <div className="border-t border-black/8">
            {rows.map(({ payment, deal }) => (
              <form
                key={payment.id}
                action={savePaymentAction}
                className="grid gap-0 border-b border-black/8 bg-white xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.95fr)]"
              >
                <input type="hidden" name="dealId" value={deal.id} />

                <div className="border-b border-black/8 px-0 py-6 xl:border-r xl:border-b-0 xl:pr-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                        {deal.brandName}
                      </p>
                      <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                        {deal.campaignName}
                      </h2>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Badge className={paymentBadgeClass(payment.status)}>
                          {humanizeToken(payment.status)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Due {formatDate(payment.dueDate)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Paid {formatDate(payment.paidDate)}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/app/deals/${deal.id}`}
                      className="inline-flex border-b border-black/20 pb-1 text-sm font-medium text-foreground transition hover:border-black/50"
                    >
                      Open workspace
                    </Link>
                  </div>

                  <div className="mt-8 border-t border-black/8 pt-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                          Payment preview
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Current invoice timing and payout state for this workspace.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-y border-black/8 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                      <span>Invoice</span>
                      <span>Issued</span>
                      <span>Due</span>
                      <span>Amount</span>
                    </div>
                    <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] py-4 text-sm text-foreground">
                      <span>{payment.invoiceDate ? `Issued invoice` : "Not invoiced yet"}</span>
                      <span>{formatDate(payment.invoiceDate)}</span>
                      <span>{formatDate(payment.dueDate)}</span>
                      <span className="font-semibold">
                        {formatCurrency(payment.amount, payment.currency ?? "USD")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-0 py-6 xl:pl-8">
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                      Payment editor
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      Update invoice details
                    </h3>
                  </div>

                  <div className="grid gap-4 border-t border-black/8 pt-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Amount
                      <input
                        className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                        type="number"
                        step="0.01"
                        name="amount"
                        defaultValue={payment.amount ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Currency
                      <input
                        className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                        name="currency"
                        defaultValue={payment.currency ?? "USD"}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Invoice date
                      <input
                        className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                        type="date"
                        name="invoiceDate"
                        defaultValue={payment.invoiceDate?.slice(0, 10) ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Due date
                      <input
                        className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                        type="date"
                        name="dueDate"
                        defaultValue={payment.dueDate?.slice(0, 10) ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Paid date
                      <input
                        className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                        type="date"
                        name="paidDate"
                        defaultValue={payment.paidDate?.slice(0, 10) ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Status
                      <select
                        className="border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                        name="status"
                        defaultValue={payment.status}
                      >
                        <option value="not_invoiced">Not invoiced</option>
                        <option value="invoiced">Invoiced</option>
                        <option value="awaiting_payment">Awaiting payment</option>
                        <option value="paid">Paid</option>
                        <option value="late">Late</option>
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                      Notes
                      <textarea
                        className="min-h-28 border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                        name="notes"
                        defaultValue={payment.notes ?? ""}
                      />
                    </label>

                    <div className="md:col-span-2 flex justify-end">
                      <SubmitButton
                        pendingLabel="Saving payment..."
                        className="bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save payment
                      </SubmitButton>
                    </div>
                  </div>
                </div>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
