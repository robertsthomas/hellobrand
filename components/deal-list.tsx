import Link from "next/link";

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
          Create your first campaign workspace and upload a sponsorship contract to
          generate a plain-English report.
        </p>
        <Link
          href="/app/intake/new"
          className="mt-6 inline-flex rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white"
        >
          Start intake
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {deals.map((deal) => (
        <Link
          key={deal.id}
          href={`/app/deals/${deal.id}`}
          className="app-surface app-surface-hover grid gap-4 p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {deal.brandName}
              </p>
              <h3 className="mt-2 text-[20px] font-semibold text-foreground">
                {deal.campaignName}
              </h3>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
              {humanizeToken(deal.status)}
            </span>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
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
          </div>
        </Link>
      ))}
    </div>
  );
}
