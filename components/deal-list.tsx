import Link from "next/link";
import { Trash2 } from "lucide-react";

import { deleteWorkspaceAction } from "@/app/actions";
import { DeleteWorkspaceButton } from "@/components/delete-workspace-button";
import type { DealRecord } from "@/lib/types";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

export function DealList({
  deals
}: {
  deals: Array<DealRecord & { paymentAmount?: number | null; currency?: string | null }>;
}) {
  if (deals.length === 0) {
    return (
      <div className="app-surface border-dashed p-10 text-center">
        <h2 className="text-3xl font-semibold text-ocean">No deals yet</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Start a new deal workspace by uploading the first contract or brand
          documents.
        </p>
        <Link
          href="/app/intake/new?pick=1"
          className="mt-6 inline-flex rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white"
          aria-label="Upload documents for a new deal workspace"
          title="Start a new deal workspace"
        >
          Upload documents
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {deals.map((deal) => (
        <article key={deal.id} className="app-surface grid gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={`/app/deals/${deal.id}`} className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {deal.brandName}
              </p>
              <h3 className="mt-2 text-[20px] font-semibold text-foreground">
                {deal.campaignName}
              </h3>
            </Link>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                {humanizeToken(deal.status)}
              </span>
              <form action={deleteWorkspaceAction}>
                <input type="hidden" name="dealId" value={deal.id} />
                <input type="hidden" name="redirectTo" value="/app/deals/history" />
                <DeleteWorkspaceButton
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/55 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/55"
                  label={`Delete ${deal.campaignName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </DeleteWorkspaceButton>
              </form>
            </div>
          </div>
          <Link
            href={`/app/deals/${deal.id}`}
            className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3"
          >
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Payment
              </div>
              <div className="text-foreground">
                {formatCurrency(deal.paymentAmount ?? null, deal.currency ?? "USD")}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Next deliverable
              </div>
              <div className="text-foreground">{formatDate(deal.nextDeliverableDate)}</div>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Payment status
              </div>
              <div className="text-foreground">{humanizeToken(deal.paymentStatus)}</div>
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
