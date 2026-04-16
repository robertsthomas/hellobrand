import Link from "next/link";

import { formatCurrency, formatDate } from "@/lib/utils";

export function PaymentsWorkspaceHeader({
  campaignName,
  brandName,
  amount,
  currency,
  dueDate,
}: {
  campaignName: string;
  brandName: string;
  amount: number | null;
  currency: string | null;
  dueDate: string | null;
}) {
  return (
    <section className="space-y-5 border-b border-black/8 pb-8">
      <Link
        href="/app/payments"
        className="inline-flex border-b border-black/20 pb-1 text-sm font-medium text-foreground transition hover:border-black/50"
      >
        Back to payments
      </Link>

      <div className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Payments
        </p>
        <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.06em] text-foreground">
          {campaignName}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {brandName} · Total {formatCurrency(amount, currency ?? "USD")} · Due{" "}
          {formatDate(dueDate)}
        </p>
      </div>
    </section>
  );
}
