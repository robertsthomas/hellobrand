import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { formatCurrency, humanizeToken } from "@/lib/utils";

export function WorkspaceDetailHeader({
  backHref,
  backLabel,
  action,
  campaignName,
  brandName,
  status,
  paymentStatus,
  paymentAmount,
  currency,
  nextDeliverableValue,
  deliverableCount,
}: {
  backHref: string;
  backLabel: string;
  action?: ReactNode;
  campaignName: string;
  brandName: string;
  status: string;
  paymentStatus: string;
  paymentAmount: number | null;
  currency: string | null;
  nextDeliverableValue: string;
  deliverableCount: number;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        {action}
      </div>

      <div className="border-b border-black/8 pb-6 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[34px] lg:text-[40px]">
              {campaignName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {brandName} · {humanizeToken(status)} · {humanizeToken(paymentStatus)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#7CB08B]" />
            <span className="text-sm font-medium text-foreground">
              {humanizeToken(status)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border-b border-black/8 pb-3 dark:border-white/10">
          <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Payment</p>
          <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-[22px]">
            {formatCurrency(paymentAmount, currency ?? "USD")}
          </p>
        </div>
        <div className="border-b border-black/8 pb-3 dark:border-white/10">
          <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Next due</p>
          <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-[22px]">
            {nextDeliverableValue}
          </p>
        </div>
        <div className="border-b border-black/8 pb-3 dark:border-white/10">
          <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3]">Deliverables</p>
          <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-[22px]">
            {deliverableCount} pending
          </p>
        </div>
      </div>
    </section>
  );
}
