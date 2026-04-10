/**
 * Deal CRUD operations and summary variant management.
 * This is the main entry point for reading and writing deal records.
 */
import {
  buildConflictResults,
} from "@/lib/conflict-intelligence";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import {
  assertViewerWithinUsageLimit,
} from "@/lib/billing/entitlements";
import {
  emitNotificationSeedForUser
} from "@/lib/notification-service";
import { getRepository } from "@/lib/repository";
import { buildGeneratedSummaryVariant } from "@/lib/summary-variants";
import { getLatestSummaryByType } from "@/lib/summaries";
import type {
  DealAggregate,
  DealRecord,
  SummaryType,
  Viewer
} from "@/lib/types";
import {
  createEmptyTerms,
  hydrateProfileBackedCreatorName,
  mergeTerms,
  queueAssistantSnapshotRefresh,
} from "./shared";

export async function listDealsForViewer(viewer: Viewer) {
  return getRepository().listDeals(viewer.id);
}

export async function loadRawDealAggregatesForViewer(viewer: Viewer) {
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

export async function listDealAggregatesForViewer(viewer: Viewer) {
  const aggregates = await loadRawDealAggregatesForViewer(viewer);

  return aggregates.map((aggregate) => ({
    ...aggregate,
    conflictResults: buildConflictResults(aggregate, aggregates)
  }));
}

export async function listDocumentsForViewer(viewer: Viewer, dealId: string) {
  return getRepository().listDocuments(viewer.id, dealId);
}

export async function getDealForViewer(viewer: Viewer, dealId: string) {
  const target = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!target) {
    return null;
  }
  const normalizedTarget = await hydrateProfileBackedCreatorName(viewer, target);

  const aggregates = await loadRawDealAggregatesForViewer(viewer);
  const comparisonSet = aggregates.some((aggregate) => aggregate.deal.id === dealId)
    ? aggregates
    : [normalizedTarget, ...aggregates];

  return {
    ...normalizedTarget,
    conflictResults: buildConflictResults(normalizedTarget, comparisonSet)
  };
}

export async function createDealForViewer(
  viewer: Viewer,
  input: Pick<DealRecord, "brandName" | "campaignName"> & { notes?: string | null }
) {
  await assertViewerWithinUsageLimit(viewer, "active_workspaces");
  const deal = await getRepository().createDeal(viewer.id, input);

  if (input.notes?.trim()) {
    await getRepository().upsertTerms(
      deal.id,
      mergeTerms(createEmptyTerms(deal), {
        ...createEmptyTerms(deal),
        notes: input.notes.trim()
      })
    );
  }

  void queueAssistantSnapshotRefresh(viewer, deal.id).catch(() => undefined);

  return deal;
}

export async function updateDealForViewer(
  viewer: Viewer,
  dealId: string,
  patch: Partial<DealRecord>
) {
  const deal = await getRepository().updateDeal(viewer.id, dealId, patch);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return deal;
}

export async function deleteDealForViewer(viewer: Viewer, dealId: string) {
  const repository = getRepository();

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const deal = await repository.getDealAggregate(viewer.id, dealId);
      if (deal) {
        const session = await prisma.intakeSession.findUnique({
          where: { dealId },
          select: { id: true }
        });
        const sessionId = session?.id ?? dealId;

        await emitNotificationSeedForUser(viewer.id, {
          category: "workspace",
          eventType: "workspace.deleted",
          entityType: "workspace",
          entityId: sessionId,
          sessionId,
          dealId,
          title: `Workspace deleted: ${deal.deal.brandName || deal.deal.campaignName || "Untitled"}`,
          description: "This workspace was deleted and cannot be recovered.",
          href: "/app",
          dedupeKey: `workspace.deleted:${sessionId}`,
          createdAt: new Date()
        });
      }
    } catch {
      // Notification failure should not block deletion
    }
  }

  return repository.deleteDeal(viewer.id, dealId);
}

export async function activateSummaryVariantForViewer(
  viewer: Viewer,
  dealId: string,
  summaryType: SummaryType
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);

  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const latestLegal = getLatestSummaryByType(aggregate.summaries, "legal");
  if (!latestLegal) {
    throw new Error("No legal summary is available for this workspace yet.");
  }

  if (summaryType === "legal") {
    const restored = await repository.restoreSummary(dealId, latestLegal.id);

    if (!restored) {
      throw new Error("Could not restore the legal summary.");
    }

    await repository.updateDeal(viewer.id, dealId, {
      summary: restored.body
    });
    void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
    return restored;
  }

  const latestVariant = getLatestSummaryByType(aggregate.summaries, summaryType);
  if (latestVariant?.parentSummaryId === latestLegal.id) {
    const restored = await repository.restoreSummary(dealId, latestVariant.id);

    if (!restored) {
      throw new Error("Could not restore the saved summary variant.");
    }

    await repository.updateDeal(viewer.id, dealId, {
      summary: restored.body
    });
    void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
    return restored;
  }

  const generated = await buildGeneratedSummaryVariant({
    aggregate,
    baseSummary: latestLegal,
    targetType: summaryType
  });
  const saved = await repository.saveSummary(dealId, latestLegal.documentId, generated);

  await repository.updateDeal(viewer.id, dealId, {
    summary: saved.body
  });
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return saved;
}

export async function restoreSummaryForViewer(
  viewer: Viewer,
  dealId: string,
  summaryId: string
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);

  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const summary = aggregate.summaries.find((entry) => entry.id === summaryId);
  if (!summary || summary.summaryType === null) {
    throw new Error("Summary version not found.");
  }

  const restored = await repository.restoreSummary(dealId, summaryId);

  if (!restored) {
    throw new Error("Could not restore that summary version.");
  }

  await repository.updateDeal(viewer.id, dealId, {
    summary: restored.body
  });
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return restored;
}
