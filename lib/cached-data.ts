import { Prisma } from "@prisma/client";
import { cacheLife, cacheTag } from "next/cache";

import { buildConflictResults } from "@/lib/conflict-intelligence";
import { getRepository } from "@/lib/repository";
import type { DealAggregate, Viewer } from "@/lib/types";

function isLocalPoolExhaustionError(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const message = error instanceof Error ? error.message : "";

  return (
    (error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientUnknownRequestError) &&
    message.includes("MaxClientsInSessionMode")
  );
}

async function loadRawAggregates(viewerId: string) {
  try {
    const repository = getRepository();
    const deals = await repository.listDeals(viewerId);
    const results: (DealAggregate | null)[] = [];
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < deals.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await repository.getDealAggregate(viewerId, deals[currentIndex].id);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(3, deals.length) }, () => worker())
    );

    return results.filter((aggregate): aggregate is DealAggregate => aggregate !== null);
  } catch (error) {
    if (isLocalPoolExhaustionError(error)) {
      return [];
    }

    throw error;
  }
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
  const allAggregates = await getCachedDealAggregates(viewer);
  return allAggregates.find((a) => a.deal.id === dealId) ?? null;
}

async function getCachedPayments(viewer: Viewer) {
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
