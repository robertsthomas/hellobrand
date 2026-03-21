import Link from "next/link";
import { Trash2 } from "lucide-react";

import { DeleteDealDialog } from "@/components/delete-deal-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DealRecord } from "@/lib/types";
import { cn, formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

function statusBadgeClass(status: string) {
  if (status === "completed" || status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  }

  if (status === "contract_received" || status === "negotiating") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] hover:bg-[#f5f6f8]";
}

function paymentBadgeClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "late") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "awaiting_payment" || status === "invoiced") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085]";
}

export function DealList({
  deals
}: {
  deals: Array<DealRecord & { paymentAmount?: number | null; currency?: string | null }>;
}) {
  if (deals.length === 0) {
    return (
      <div className="border border-dashed border-black/10 bg-white px-8 py-16 text-center shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
        <h2 className="text-[34px] font-semibold tracking-[-0.05em] text-foreground">
          No workspaces yet
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">
          Start a new partnership workspace by uploading the first contract or brand
          documents.
        </p>
        <Link
          href="/app/intake/new"
          className={cn(buttonVariants(), "mt-6 px-5")}
          aria-label="Upload documents for a new partnership workspace"
          title="Start a new partnership workspace"
        >
          New workspace
        </Link>
      </div>
    );
  }

  return (
    <section className="border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
      <div className="overflow-hidden border border-black/8">
        <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_150px_160px_170px_150px_64px] border-b border-black/8 bg-[#f7f8fa] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
          <span>Campaign</span>
          <span>Stage</span>
          <span>Payment status</span>
          <span>Amount</span>
          <span>Next due</span>
          <span />
        </div>

        {deals.map((deal) => (
          <div
            key={deal.id}
            className="flex flex-col gap-2 border-b border-black/6 px-5 py-4 last:border-b-0 md:grid md:grid-cols-[minmax(0,1.6fr)_150px_160px_170px_150px_64px] md:items-center"
          >
            <Link href={`/app/deals/${deal.id}`} className="min-w-0 pr-4">
              <p className="truncate text-base font-semibold text-foreground">
                {deal.campaignName}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{deal.brandName}</p>
            </Link>

            <div className="flex items-center justify-between md:block">
              <span className="text-xs text-muted-foreground md:hidden">Stage</span>
              <Badge className={statusBadgeClass(deal.status)}>
                {humanizeToken(deal.status)}
              </Badge>
            </div>

            <div className="flex items-center justify-between md:block">
              <span className="text-xs text-muted-foreground md:hidden">Payment</span>
              <Badge className={paymentBadgeClass(deal.paymentStatus)}>
                {humanizeToken(deal.paymentStatus)}
              </Badge>
            </div>

            <div className="flex items-center justify-between md:block">
              <span className="text-xs text-muted-foreground md:hidden">Amount</span>
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(deal.paymentAmount ?? null, deal.currency ?? "USD")}
              </span>
            </div>

            <div className="flex items-center justify-between md:block">
              <span className="text-xs text-muted-foreground md:hidden">Next due</span>
              <span className="text-sm text-muted-foreground">
                {formatDate(deal.nextDeliverableDate)}
              </span>
            </div>

            <div className="flex justify-end">
              <DeleteDealDialog
                dealId={deal.id}
                dealName={deal.campaignName}
                redirectTo="/app/deals/history"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/8 text-[#667085] transition hover:border-accent/30 hover:text-accent"
                triggerLabel={`Delete ${deal.campaignName}`}
              >
                <Trash2 className="h-4 w-4" />
              </DeleteDealDialog>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
