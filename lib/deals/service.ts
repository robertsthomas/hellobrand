/**
 * Deal CRUD operations and summary variant management.
 * This is the main entry point for reading and writing deal records.
 */

import { esignatureEnabled } from "@/flags";
import { assertViewerWithinUsageLimit } from "@/lib/billing/entitlements";
import { buildConflictResultsIfEnabled } from "@/lib/conflict-intelligence";
import { createAndSendSigningRequest } from "@/lib/documenso";
import { emitNotificationSeedForUser } from "@/lib/notification-service";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { readStoredBytes } from "@/lib/storage";
import { getLatestSummaryByType } from "@/lib/summaries";
import { buildGeneratedSummaryVariant } from "@/lib/summary-variants";
import type { DealAggregate, DealRecord, GeneratedBrief, SummaryType, Viewer } from "@/lib/types";
import {
  createEmptyTerms,
  hydrateProfileBackedCreatorName,
  mergeTerms,
  queueAssistantSnapshotRefresh,
} from "./shared";

export async function listDealsForViewer(viewer: Viewer) {
  return getRepository().listDeals(viewer.id);
}

async function loadRawDealAggregatesForViewer(viewer: Viewer) {
  const repository = getRepository();
  const deals = await repository.listDeals(viewer.id);
  const results: (DealAggregate | null)[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < deals.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await repository.getDealAggregate(viewer.id, deals[currentIndex].id);
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, deals.length) }, () => worker()));

  return results.filter((aggregate): aggregate is DealAggregate => aggregate !== null);
}

export async function listDealAggregatesForViewer(viewer: Viewer) {
  const aggregates = await loadRawDealAggregatesForViewer(viewer);

  const withConflicts = await Promise.all(
    aggregates.map(async (aggregate) => ({
      ...aggregate,
      conflictResults: await buildConflictResultsIfEnabled(aggregate, aggregates),
    }))
  );
  return withConflicts;
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
    conflictResults: await buildConflictResultsIfEnabled(normalizedTarget, comparisonSet),
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
        notes: input.notes.trim(),
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

function pickSigningDocument(aggregate: DealAggregate) {
  return (
    aggregate.documents.find(
      (document) => document.mimeType === "application/pdf" && document.documentKind === "contract"
    ) ??
    aggregate.documents.find((document) => document.mimeType === "application/pdf") ??
    null
  );
}

function buildCounterpartyRecipient(aggregate: DealAggregate) {
  const terms = aggregate.terms;
  const briefData = terms?.briefData;
  if (!briefData) {
    return null;
  }

  const email = briefData.agencyContactEmail ?? briefData.brandContactEmail;
  if (!email) {
    return null;
  }

  return {
    email,
    name:
      briefData.agencyContactName ??
      briefData.brandContactName ??
      terms.agencyName ??
      terms.brandName ??
      aggregate.deal.brandName,
  };
}

export async function sendDealForESignature(viewer: Viewer, dealId: string) {
  if (!(await esignatureEnabled())) {
    throw new Error("eSignature is not enabled.");
  }

  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  if (aggregate.deal.esignStatus === "PENDING") {
    throw new Error("This workspace has already been sent for eSignature.");
  }

  if (aggregate.deal.esignStatus === "COMPLETED") {
    throw new Error("This workspace has already been signed.");
  }

  const document = pickSigningDocument(aggregate);
  if (!document) {
    throw new Error("Upload a PDF contract before sending for eSignature.");
  }

  const counterparty = buildCounterpartyRecipient(aggregate);
  if (!counterparty) {
    throw new Error("Add a brand or agency contact email in Terms before sending for eSignature.");
  }

  const profile = await getProfileForViewer(viewer);
  const creatorEmail = profile.contactEmail?.trim() || viewer.email;
  const creatorName =
    profile.creatorLegalName?.trim() || profile.displayName?.trim() || viewer.displayName;
  const pdfBuffer = await readStoredBytes(document.storagePath);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.INTEGRATIONS_APP_URL ?? "";

  const envelope = await createAndSendSigningRequest({
    dealId,
    userId: viewer.id,
    pdfBuffer,
    filename: document.fileName,
    title: aggregate.deal.campaignName || document.fileName,
    recipients: [
      {
        email: creatorEmail,
        name: creatorName,
        role: "SIGNER",
      },
      {
        email: counterparty.email,
        name: counterparty.name,
        role: "SIGNER",
      },
    ],
    redirectUrl: appUrl ? `${appUrl}/app/p/${dealId}` : undefined,
  });

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return {
    envelopeId: envelope.id,
    documentId: document.id,
  };
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
          select: { id: true },
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
          createdAt: new Date(),
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
    const activated = await repository.setCurrentSummary(dealId, latestLegal.id);

    if (!activated) {
      throw new Error("Could not switch to the legal summary.");
    }

    await repository.updateDeal(viewer.id, dealId, {
      summary: activated.body,
    });
    void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
    return activated;
  }

  const latestVariant = getLatestSummaryByType(aggregate.summaries, summaryType);
  if (latestVariant?.parentSummaryId === latestLegal.id) {
    const activated = await repository.setCurrentSummary(dealId, latestVariant.id);

    if (!activated) {
      throw new Error("Could not switch to the saved summary variant.");
    }

    await repository.updateDeal(viewer.id, dealId, {
      summary: activated.body,
    });
    void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
    return activated;
  }

  const generated = await buildGeneratedSummaryVariant({
    aggregate,
    baseSummary: latestLegal,
    targetType: summaryType,
  });
  const saved = await repository.saveSummary(dealId, latestLegal.documentId, generated);

  await repository.updateDeal(viewer.id, dealId, {
    summary: saved.body,
  });
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return saved;
}

export async function saveGeneratedBriefSummaryForViewer(
  viewer: Viewer,
  dealId: string,
  generatedSummary: GeneratedBrief
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);

  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const currentTerms = aggregate.terms ?? createEmptyTerms(aggregate.deal);
  const currentBriefData = currentTerms.briefData;

  if (!currentBriefData) {
    throw new Error("No uploaded brief is available for this workspace.");
  }

  const nextTerms = mergeTerms(currentTerms, {
    briefData: {
      ...currentBriefData,
      generatedSummary,
    },
  });

  const savedTerms = await repository.upsertTerms(dealId, nextTerms);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return savedTerms;
}
