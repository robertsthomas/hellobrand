import { cacheLife, cacheTag } from "next/cache";

import { buildConflictResults } from "@/lib/conflict-intelligence";
import { getRepository } from "@/lib/repository";
import type { DealAggregate, Viewer } from "@/lib/types";

async function loadRawAggregates(viewerId: string) {
  const repository = getRepository();
  const deals = await repository.listDeals(viewerId);
  const aggregates: DealAggregate[] = [];

  for (const deal of deals) {
    const aggregate = await repository.getDealAggregate(viewerId, deal.id);

    if (aggregate) {
      aggregates.push(aggregate);
    }
  }

  return aggregates;
}

export async function getCachedDealAggregates(viewer: Viewer) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-${viewer.id}-deals`);

  const aggregates = await loadRawAggregates(viewer.id);

  return aggregates.map((aggregate) => ({
    ...aggregate,
    conflictResults: buildConflictResults(aggregate, aggregates)
  }));
}

export async function getCachedIntakeDrafts(viewer: Viewer) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-${viewer.id}-deals`);

  const { listIntakeDraftsForViewer } = await import("@/lib/intake");
  return listIntakeDraftsForViewer(viewer);
}

export async function getCachedDealForViewer(viewer: Viewer, dealId: string) {
  "use cache";
  cacheLife("seconds");
  cacheTag(`user-${viewer.id}-deals`, `deal-${dealId}`);

  const target = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!target) return null;

  const aggregates = await loadRawAggregates(viewer.id);
  const comparisonSet = aggregates.some((a) => a.deal.id === dealId)
    ? aggregates
    : [target, ...aggregates];

  return {
    ...target,
    conflictResults: buildConflictResults(target, comparisonSet)
  };
}

export async function getCachedPayments(viewer: Viewer) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-${viewer.id}-payments`);

  const { listPaymentsForViewer } = await import("@/lib/payments");
  return listPaymentsForViewer(viewer);
}

export async function getCachedProfile(viewer: Viewer) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-${viewer.id}-profile`);

  const { getProfileForViewer } = await import("@/lib/profile");
  return getProfileForViewer(viewer);
}

export async function getCachedOnboardingState(viewer: Viewer) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-${viewer.id}-onboarding`);

  const { getOnboardingStateForViewer } = await import("@/lib/onboarding");
  return getOnboardingStateForViewer(viewer);
}

export async function getCachedProfileAudit(viewer: Viewer) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-${viewer.id}-profile`);

  const { listProfileAuditForViewer } = await import("@/lib/profile");
  return listProfileAuditForViewer(viewer);
}
