import { buildConflictResults } from "@/lib/conflict-intelligence";
import { getRepository } from "@/lib/repository";
import type {
  AssistantContextSnapshotRecord,
  AssistantScope,
  DealAggregate,
  Viewer,
} from "@/lib/types";

import { assistantDealTabs, assistantRouteTargets } from "@/lib/assistant/app-manual";

const ASSISTANT_SNAPSHOT_VERSION = "assistant-v1";
const pendingSnapshotRefreshes = new Map<string, Promise<void>>();

async function loadAggregatesForViewer(viewer: Viewer) {
  const repository = getRepository();
  const deals = await repository.listDeals(viewer.id);
  const aggregates: DealAggregate[] = [];

  for (const deal of deals) {
    const aggregate = await repository.getDealAggregate(viewer.id, deal.id);

    if (aggregate) {
      aggregates.push(aggregate);
    }
  }

  return aggregates;
}

function dealSnapshotSummary(aggregate: DealAggregate, comparisonSet: DealAggregate[]) {
  const conflicts = buildConflictResults(aggregate, comparisonSet);

  return {
    summary: [
      `${aggregate.deal.brandName} / ${aggregate.deal.campaignName}`,
      `Status: ${aggregate.deal.status}`,
      aggregate.terms?.paymentTerms
        ? `Payment: ${aggregate.terms.paymentTerms}`
        : "Payment terms not extracted",
      aggregate.riskFlags.length > 0
        ? `${aggregate.riskFlags.length} risk flag(s)`
        : "No active risk flags",
      conflicts.length > 0
        ? `${conflicts.length} cross-partnership conflict warning(s)`
        : "No cross-partnership conflicts",
    ].join(" | "),
    payload: {
      deal: {
        id: aggregate.deal.id,
        brandName: aggregate.deal.brandName,
        campaignName: aggregate.deal.campaignName,
        status: aggregate.deal.status,
        paymentStatus: aggregate.deal.paymentStatus,
        countersignStatus: aggregate.deal.countersignStatus,
        summary:
          aggregate.currentSummary?.body ??
          aggregate.deal.summary ??
          "No current summary available.",
      },
      terms: aggregate.terms,
      paymentRecord: aggregate.paymentRecord,
      riskFlags: aggregate.riskFlags,
      conflicts,
      evidence: aggregate.extractionEvidence,
      documents: aggregate.documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        documentKind: document.documentKind,
        updatedAt: document.updatedAt,
      })),
      tabs: assistantDealTabs,
    },
  };
}

function userSnapshotSummary(aggregates: DealAggregate[]) {
  const portfolio = aggregates.map((aggregate) => {
    const conflicts = buildConflictResults(aggregate, aggregates);

    return {
      dealId: aggregate.deal.id,
      brandName: aggregate.deal.brandName,
      campaignName: aggregate.deal.campaignName,
      status: aggregate.deal.status,
      paymentStatus: aggregate.deal.paymentStatus,
      nextDeliverableDate: aggregate.deal.nextDeliverableDate,
      paymentTerms: aggregate.terms?.paymentTerms ?? null,
      paymentAmount: aggregate.terms?.paymentAmount ?? null,
      currency: aggregate.terms?.currency ?? null,
      riskCount: aggregate.riskFlags.length,
      highRiskCount: aggregate.riskFlags.filter((flag) => flag.severity === "high").length,
      conflictCount: conflicts.length,
    };
  });

  return {
    summary: [
      `${portfolio.length} active workspace(s)`,
      `${portfolio.reduce((count, partnership) => count + partnership.riskCount, 0)} total risk flag(s)`,
      `${portfolio.filter((deal) => deal.paymentStatus === "late").length} late payment partnership workspace(s)`,
    ].join(" | "),
    payload: {
      portfolio,
      routes: assistantRouteTargets,
    },
  };
}

function assistantSnapshotKey(scope: AssistantScope, dealId?: string | null) {
  return scope === "deal" && dealId ? `deal:${dealId}` : "user";
}

export async function refreshAssistantSnapshotsForViewer(
  viewer: Viewer,
  options?: { dealId?: string | null }
) {
  const refreshKey = viewer.id;
  const existing = pendingSnapshotRefreshes.get(refreshKey);

  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    const repository = getRepository();
    const aggregates = await loadAggregatesForViewer(viewer);
    const userSnapshot = userSnapshotSummary(aggregates);

    await repository.saveAssistantContextSnapshot(viewer.id, {
      dealId: null,
      scope: "user",
      key: assistantSnapshotKey("user"),
      version: ASSISTANT_SNAPSHOT_VERSION,
      summary: userSnapshot.summary,
      payload: userSnapshot.payload,
    });

    if (options?.dealId) {
      const target = aggregates.find((aggregate) => aggregate.deal.id === options.dealId);

      if (target) {
        const dealSnapshot = dealSnapshotSummary(target, aggregates);
        await repository.saveAssistantContextSnapshot(viewer.id, {
          dealId: target.deal.id,
          scope: "deal",
          key: assistantSnapshotKey("deal", target.deal.id),
          version: ASSISTANT_SNAPSHOT_VERSION,
          summary: dealSnapshot.summary,
          payload: dealSnapshot.payload,
        });
      }
    }
  })().finally(() => {
    pendingSnapshotRefreshes.delete(refreshKey);
  });

  pendingSnapshotRefreshes.set(refreshKey, task);
  await task;
}

export async function ensureAssistantSnapshot(
  viewer: Viewer,
  scope: AssistantScope,
  dealId?: string | null
): Promise<AssistantContextSnapshotRecord | null> {
  const repository = getRepository();
  const key = assistantSnapshotKey(scope, dealId);
  const existing = await repository.getAssistantContextSnapshot(viewer.id, key);

  if (existing?.version === ASSISTANT_SNAPSHOT_VERSION) {
    return existing;
  }

  await refreshAssistantSnapshotsForViewer(viewer, { dealId });
  return repository.getAssistantContextSnapshot(viewer.id, key);
}

export function defaultAssistantThreadTitle(
  scope: AssistantScope,
  options?: { dealName?: string | null }
) {
  if (scope === "deal" && options?.dealName) {
    return `${options.dealName} assistant`;
  }

  return "HelloBrand assistant";
}
