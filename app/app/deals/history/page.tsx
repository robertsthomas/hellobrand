import { Suspense } from "react";

import { DealHistoryTable, type DealHistoryRow } from "@/components/deal-history-table";
import { TableSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { getCachedDealAggregates } from "@/lib/cached-data";
import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import type { DealRecord } from "@/lib/types";


function mapStageGroup(
  deal: Pick<DealRecord, "status" | "paymentStatus">
): DealHistoryRow["stageGroup"] {
  if (deal.status === "paid" || deal.status === "completed" || deal.paymentStatus === "paid") {
    return "completed";
  }

  if (deal.status === "contract_received" || deal.status === "negotiating") {
    return "under_review";
  }

  return "active";
}

function mapStageLabel(
  deal: Pick<DealRecord, "status" | "paymentStatus">
): DealHistoryRow["stageLabel"] {
  if (deal.status === "paid" || deal.status === "completed" || deal.paymentStatus === "paid") {
    return "Completed";
  }

  if (deal.status === "contract_received" || deal.status === "negotiating") {
    return "Under Review";
  }

  return "Active";
}

function getDealDate(deal: Pick<DealRecord, "confirmedAt" | "updatedAt" | "createdAt">) {
  return deal.confirmedAt ?? deal.updatedAt ?? deal.createdAt ?? null;
}

function getDeliverablesLabel(count: number) {
  if (count <= 0) {
    return "Not started";
  }

  if (count === 1) {
    return "1 pending";
  }

  return `${count} pending`;
}

export default function DealHistoryPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-[1400px]"><TableSkeleton rows={6} /></div></div>}>
      <DealHistoryContent />
    </Suspense>
  );
}

async function DealHistoryContent() {
  const viewer = await requireViewer();
  const aggregates = await getCachedDealAggregates(viewer);

  const rows: DealHistoryRow[] = aggregates.map((aggregate) => {
    const normalized = buildNormalizedIntakeRecord(aggregate);
    const normalizedDeliverables = Array.isArray(normalized?.deliverables)
      ? normalized.deliverables
      : [];
    const persistedDeliverables = Array.isArray(aggregate.terms?.deliverables)
      ? aggregate.terms.deliverables
      : [];
    const deliverableCount = normalizedDeliverables.length || persistedDeliverables.length;
    const amount = aggregate.terms?.paymentAmount ?? aggregate.paymentRecord?.amount ?? null;
    const currency = aggregate.terms?.currency ?? aggregate.paymentRecord?.currency ?? "USD";

    return {
      id: aggregate.deal.id,
      brandName: normalized?.brandName ?? aggregate.deal.brandName,
      campaignName: normalized?.contractTitle ?? aggregate.deal.campaignName,
      amount,
      currency,
      stageLabel: mapStageLabel(aggregate.deal),
      stageGroup: mapStageGroup(aggregate.deal),
      date: getDealDate(aggregate.deal),
      deliverablesLabel: getDeliverablesLabel(deliverableCount),
      riskCount: aggregate.riskFlags.length
    };
  });

  const totalDeals = rows.length;
  const activeDeals = rows.filter((row) => row.stageGroup === "active").length;
  const totalEarned = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const averageDealSize = totalDeals === 0 ? 0 : totalEarned / totalDeals;

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1400px]">
        <DealHistoryTable
          rows={rows}
          metrics={{
            totalDeals,
            activeDeals,
            totalEarned,
            averageDealSize
          }}
        />
      </div>
    </div>
  );
}
