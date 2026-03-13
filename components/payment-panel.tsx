"use client";

import Link from "next/link";

import { savePaymentAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";
import type { PaymentRecord } from "@/lib/types";

export function PaymentPanel({
  dealId,
  payment
}: {
  dealId: string;
  payment: PaymentRecord | null;
}) {
  return (
    <section className="rounded-[1.75rem] border border-black/5 bg-white/85 p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Payment</h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/65">
            Track the primary payout for this deal and keep payment status in sync
            with the dashboard.
          </p>
        </div>
        <Link
          href="/app/payments"
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink dark:border-white/12 dark:text-white"
        >
          Open payments
        </Link>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
          <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
            Amount
          </div>
          <div className="mt-2 text-xl font-semibold text-ink">
            {formatCurrency(payment?.amount ?? null, payment?.currency ?? "USD")}
          </div>
        </div>
        <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
          <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
            Status
          </div>
          <div className="mt-2 text-xl font-semibold text-ink">
            {humanizeToken(payment?.status ?? "not_invoiced")}
          </div>
        </div>
        <div className="rounded-[1.25rem] bg-sand/50 p-4 dark:bg-white/[0.04]">
          <div className="text-xs uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
            Due date
          </div>
          <div className="mt-2 text-xl font-semibold text-ink">
            {formatDate(payment?.dueDate ?? null)}
          </div>
        </div>
      </div>

      <form action={savePaymentAction} className="mt-6 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="dealId" value={dealId} />
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Amount
          <input
            className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
            type="number"
            step="0.01"
            name="amount"
            defaultValue={payment?.amount ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Currency
          <input
            className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
            name="currency"
            defaultValue={payment?.currency ?? "USD"}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Invoice date
          <input
            className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
            type="date"
            name="invoiceDate"
            defaultValue={payment?.invoiceDate?.slice(0, 10) ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Due date
          <input
            className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
            type="date"
            name="dueDate"
            defaultValue={payment?.dueDate?.slice(0, 10) ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Paid date
          <input
            className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
            type="date"
            name="paidDate"
            defaultValue={payment?.paidDate?.slice(0, 10) ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Status
          <select
            className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 dark:border-white/12 dark:bg-white/[0.04]"
            name="status"
            defaultValue={payment?.status ?? "not_invoiced"}
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
            className="min-h-28 rounded-[1.5rem] border border-black/10 bg-sand/40 px-4 py-4 dark:border-white/12 dark:bg-white/[0.04]"
            name="notes"
            defaultValue={payment?.notes ?? ""}
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
      </form>
    </section>
  );
}
