import { saveDealMetaAction } from "@/app/actions";
import type { CountersignStatus, DealStatus, PaymentStatus } from "@/lib/types";
import { humanizeToken } from "@/lib/utils";

const dealStatuses: DealStatus[] = [
  "contract_received",
  "negotiating",
  "signed",
  "deliverables_pending",
  "submitted",
  "awaiting_payment",
  "paid",
  "completed"
];

const paymentStatuses: PaymentStatus[] = [
  "not_invoiced",
  "invoiced",
  "awaiting_payment",
  "paid",
  "late"
];

const countersignStatuses: CountersignStatus[] = ["unknown", "pending", "signed"];

export function DealStatusPanel({
  dealId,
  status,
  paymentStatus,
  countersignStatus
}: {
  dealId: string;
  status: DealStatus;
  paymentStatus: PaymentStatus;
  countersignStatus: CountersignStatus;
}) {
  return (
    <form
      action={saveDealMetaAction}
      className="grid gap-4 rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-panel"
    >
      <div>
        <h2 className="font-serif text-3xl text-ocean">Workspace status</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/65">
          Track the business state of the deal separately from technical document
          processing.
        </p>
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Deal stage
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="status"
            defaultValue={status}
          >
            {dealStatuses.map((option) => (
              <option key={option} value={option}>
                {humanizeToken(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Payment state
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="paymentStatus"
            defaultValue={paymentStatus}
          >
            {paymentStatuses.map((option) => (
              <option key={option} value={option}>
                {humanizeToken(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
          Countersign status
          <select
            className="rounded-2xl border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3"
            name="countersignStatus"
            defaultValue={countersignStatus}
          >
            {countersignStatuses.map((option) => (
              <option key={option} value={option}>
                {humanizeToken(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="inline-flex w-fit rounded-full border border-black/10 dark:border-white/12 bg-white dark:bg-white/10 dark:text-white px-5 py-3 text-sm font-semibold text-ink">
        Save status
      </button>
    </form>
  );
}
