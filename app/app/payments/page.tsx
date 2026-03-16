import Link from "next/link";

import { savePaymentAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth";
import { listPaymentsForViewer } from "@/lib/payments";
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

export default async function PaymentsPage() {
  const viewer = await requireViewer();
  const rows = await listPaymentsForViewer(viewer);

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
      <div className="mx-auto max-w-[1380px] space-y-6">
        <section className="rounded-[28px] border border-black/8 bg-white px-7 py-7 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
                Invoice operations
              </p>
              <h1 className="mt-3 text-[46px] font-semibold tracking-[-0.06em] text-foreground">
                Payments
              </h1>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Track payout status, update due dates, and keep invoice notes in
                one cleaner finance view for each workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-black/8 bg-[#fbfbfc] px-5 py-5">
                <p className="text-sm text-muted-foreground">Tracked</p>
                <p className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                  {formatCurrency(totals.total)}
                </p>
              </div>
              <div className="rounded-[22px] border border-black/8 bg-[#fbfbfc] px-5 py-5">
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                  {formatCurrency(totals.outstanding)}
                </p>
              </div>
              <div className="rounded-[22px] border border-black/8 bg-[#fbfbfc] px-5 py-5">
                <p className="text-sm text-muted-foreground">Late</p>
                <p className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                  {formatCurrency(totals.late)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-black/10 bg-white px-8 py-16 text-center shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
            <h2 className="text-[34px] font-semibold tracking-[-0.05em] text-foreground">
              No payments tracked yet
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              Upload documents from the intake flow and confirm a workspace to
              start tracking payout details here.
            </p>
            <Link href="/app/intake/new" className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white">
              Start a workspace
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {rows.map(({ payment, deal }) => (
              <form
                key={payment.id}
                action={savePaymentAction}
                className="grid gap-0 overflow-hidden rounded-[28px] border border-black/8 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.05)] xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.95fr)]"
              >
                <input type="hidden" name="dealId" value={deal.id} />

                <div className="border-b border-black/8 px-6 py-6 xl:border-b-0 xl:border-r">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                        {deal.brandName}
                      </p>
                      <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-foreground">
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
                      className="rounded-2xl border border-black/8 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-[#f6f7f9]"
                    >
                      Open workspace
                    </Link>
                  </div>

                  <div className="mt-8 overflow-hidden rounded-[22px] border border-black/8">
                    <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-black/8 bg-[#f7f8fa] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                      <span>Invoice</span>
                      <span>Issued</span>
                      <span>Due</span>
                      <span>Amount</span>
                    </div>
                    <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] px-4 py-4 text-sm text-foreground">
                      <span>{payment.invoiceDate ? `Issued invoice` : "Not invoiced yet"}</span>
                      <span>{formatDate(payment.invoiceDate)}</span>
                      <span>{formatDate(payment.dueDate)}</span>
                      <span className="font-semibold">
                        {formatCurrency(payment.amount, payment.currency ?? "USD")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6">
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">
                      Payment editor
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                      Update invoice details
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Amount
                      <input
                        className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm"
                        type="number"
                        step="0.01"
                        name="amount"
                        defaultValue={payment.amount ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Currency
                      <input
                        className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm"
                        name="currency"
                        defaultValue={payment.currency ?? "USD"}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Invoice date
                      <input
                        className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm"
                        type="date"
                        name="invoiceDate"
                        defaultValue={payment.invoiceDate?.slice(0, 10) ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Due date
                      <input
                        className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm"
                        type="date"
                        name="dueDate"
                        defaultValue={payment.dueDate?.slice(0, 10) ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Paid date
                      <input
                        className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm"
                        type="date"
                        name="paidDate"
                        defaultValue={payment.paidDate?.slice(0, 10) ?? ""}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      Status
                      <select
                        className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm"
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
                        className="min-h-28 rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm"
                        name="notes"
                        defaultValue={payment.notes ?? ""}
                      />
                    </label>

                    <div className="md:col-span-2 flex justify-end">
                      <SubmitButton
                        pendingLabel="Saving payment..."
                        className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
