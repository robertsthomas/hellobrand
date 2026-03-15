import Link from "next/link";

import { savePaymentAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireViewer } from "@/lib/auth";
import { listPaymentsForViewer } from "@/lib/payments";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

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
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Payments</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Track the primary payout for each confirmed deal. This phase keeps
            one payment record per workspace and prioritizes invoice, due, and
            paid-state clarity.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-white/85 p-6 shadow-panel dark:bg-white/[0.06]">
            <div className="text-sm text-black/50 dark:text-white/50">Tracked</div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {formatCurrency(totals.total)}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-white/85 p-6 shadow-panel dark:bg-white/[0.06]">
            <div className="text-sm text-black/50 dark:text-white/50">Outstanding</div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {formatCurrency(totals.outstanding)}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-white/85 p-6 shadow-panel dark:bg-white/[0.06]">
            <div className="text-sm text-black/50 dark:text-white/50">Late</div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {formatCurrency(totals.late)}
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-white/75 p-8 text-sm text-black/60 shadow-panel dark:border-white/12 dark:bg-white/[0.05] dark:text-white/65">
            No confirmed deal payments yet. Upload documents from{" "}
            <Link href="/app/intake/new" className="font-semibold text-ocean underline">
              the upload flow
            </Link>{" "}
            and confirm a deal to track payout status here.
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map(({ payment, deal }) => (
              <form
                key={payment.id}
                action={savePaymentAction}
                className="grid gap-4 rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06] xl:grid-cols-[1.1fr_1fr]"
              >
                <input type="hidden" name="dealId" value={deal.id} />
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                    {deal.brandName}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-ink">
                    {deal.campaignName}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-black/55 dark:text-white/60">
                    <span>Status: {humanizeToken(payment.status)}</span>
                    <span>Due: {formatDate(payment.dueDate)}</span>
                    <span>Paid: {formatDate(payment.paidDate)}</span>
                  </div>
                  <div className="mt-4">
                    <Link
                      href={`/app/deals/${deal.id}`}
                      className="text-sm font-semibold text-ocean underline-offset-4 hover:underline"
                    >
                      Open workspace
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Amount
                    <input
                      className="rounded-[1rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
                      type="number"
                      step="0.01"
                      name="amount"
                      defaultValue={payment.amount ?? ""}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Currency
                    <input
                      className="rounded-[1rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
                      name="currency"
                      defaultValue={payment.currency ?? "USD"}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Invoice date
                    <input
                      className="rounded-[1rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
                      type="date"
                      name="invoiceDate"
                      defaultValue={payment.invoiceDate?.slice(0, 10) ?? ""}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Due date
                    <input
                      className="rounded-[1rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
                      type="date"
                      name="dueDate"
                      defaultValue={payment.dueDate?.slice(0, 10) ?? ""}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Paid date
                    <input
                      className="rounded-[1rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
                      type="date"
                      name="paidDate"
                      defaultValue={payment.paidDate?.slice(0, 10) ?? ""}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
                    Status
                    <select
                      className="rounded-[1rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
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
                  <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75 md:col-span-2">
                    Notes
                    <textarea
                      className="min-h-24 rounded-[1rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
                      name="notes"
                      defaultValue={payment.notes ?? ""}
                    />
                  </label>
                  <div className="md:col-span-2 flex justify-end">
                    <SubmitButton
                      pendingLabel="Saving payment..."
                      className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save payment
                    </SubmitButton>
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
