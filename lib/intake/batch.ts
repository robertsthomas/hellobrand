/**
 * Bulk intake clustering and batch group workflows.
 * This file owns multi-document grouping before those groups become individual intake sessions.
 */
import { prisma } from "@/lib/prisma";
import { assertViewerWithinUsageLimit } from "@/lib/billing/entitlements";
import { getRepository } from "@/lib/repository";
import { uploadDocumentsForViewer } from "@/lib/deals";
import { intakeClusteringEnabled } from "@/flags";
import type { ClusterInput } from "@/lib/intake-clustering";
import { clusterDocuments } from "@/lib/intake-clustering";
import type { IntakeBatchRecord, Viewer } from "@/lib/types";

import { toIntakeSessionRecord } from "./shared";

export async function createBulkIntakeForViewer(
  viewer: Viewer,
  input: {
    files: File[];
    notes?: string | null;
  }
): Promise<IntakeBatchRecord> {
  await assertViewerWithinUsageLimit(viewer, "active_workspaces");
  const files = input.files.filter((file) => file.size > 0);
  if (files.length === 0) {
    throw new Error("Please upload at least one file.");
  }

  const tempDeal = await getRepository().createDeal(
    viewer.id,
    { brandName: "Bulk upload", campaignName: "Bulk upload" },
    { confirmedAt: null }
  );

  await uploadDocumentsForViewer(viewer, tempDeal.id, {
    files,
    pastedText: null,
    startProcessing: false,
  });

  const documents = await getRepository().listDocuments(viewer.id, tempDeal.id);

  const clusterInputs: ClusterInput[] = documents.map((doc) => ({
    documentId: doc.id,
    fileName: doc.fileName,
    rawText: doc.rawText ?? "",
    documentKind: doc.documentKind,
    brandHint: null,
  }));

  const clusterResult =
    (await intakeClusteringEnabled()) === true
      ? clusterDocuments(clusterInputs)
      : {
          groups: [
            { label: "Untitled brand", confidence: 0.9, documentIds: documents.map((d) => d.id) },
          ],
        };

  if (clusterResult.groups.length <= 1) {
    const group = clusterResult.groups[0];
    const brandName = group?.label ?? "Untitled brand";

    await getRepository().updateDeal(viewer.id, tempDeal.id, {
      brandName,
      campaignName: brandName,
    } as Partial<import("@/lib/types").DealRecord>);

    const session = await prisma.intakeSession.create({
      data: {
        userId: viewer.id,
        dealId: tempDeal.id,
        status: "queued",
        inputSource: "upload",
        draftBrandName: brandName,
        draftCampaignName: brandName,
        draftNotes: input.notes?.trim() || null,
        draftPastedText: null,
        draftPastedTextTitle: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    if (documents.length > 0) {
      await prisma.intakeDocument.createMany({
        data: documents.map((doc) => ({
          intakeSessionId: session.id,
          documentId: doc.id,
        })),
        skipDuplicates: true,
      });
    }

    const batch = await getRepository().createBatch(viewer.id, [
      {
        label: brandName,
        confidence: group?.confidence ?? 0.9,
        documentIds: documents.map((d) => d.id),
      },
    ]);

    return batch;
  }

  return getRepository().createBatch(
    viewer.id,
    clusterResult.groups.map((group) => ({
      label: group.label,
      confidence: group.confidence,
      documentIds: group.documentIds,
    }))
  );
}

export async function getBatchForViewer(
  viewer: Viewer,
  batchId: string
): Promise<IntakeBatchRecord> {
  const batch = await getRepository().getBatch(viewer.id, batchId);
  if (!batch) {
    throw new Error("Batch not found.");
  }
  return batch;
}

export async function confirmBatchGroupForViewer(
  viewer: Viewer,
  batchId: string,
  groupId: string,
  input: { brandName: string; campaignName: string }
) {
  const batch = await getRepository().getBatch(viewer.id, batchId);
  if (!batch) {
    throw new Error("Batch not found.");
  }

  const group = batch.groups.find((g) => g.id === groupId);
  if (!group) {
    throw new Error("Group not found in this batch.");
  }

  if (group.status !== "pending") {
    throw new Error("This group has already been processed.");
  }

  const deal = await getRepository().createDeal(
    viewer.id,
    {
      brandName: input.brandName.trim() || group.label,
      campaignName: input.campaignName.trim() || group.label,
    },
    { confirmedAt: null }
  );

  const session = await prisma.intakeSession.create({
    data: {
      userId: viewer.id,
      dealId: deal.id,
      status: "queued",
      inputSource: "upload",
      draftBrandName: input.brandName.trim() || group.label,
      draftCampaignName: input.campaignName.trim() || group.label,
      draftNotes: null,
      draftPastedText: null,
      draftPastedTextTitle: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  for (const docId of group.documentIds) {
    const existingDoc = await getRepository().getDocument(docId);
    if (existingDoc) {
      const newDoc = await getRepository().createDocument({
        dealId: deal.id,
        userId: viewer.id,
        fileName: existingDoc.fileName,
        mimeType: existingDoc.mimeType,
        storagePath: existingDoc.storagePath,
        fileSizeBytes: existingDoc.fileSizeBytes,
        checksumSha256: existingDoc.checksumSha256,
        processingStatus: "pending",
        rawText: existingDoc.rawText,
        normalizedText: existingDoc.normalizedText,
        documentKind: existingDoc.documentKind,
        classificationConfidence: existingDoc.classificationConfidence,
        sourceType: existingDoc.sourceType,
        errorMessage: null,
        processingRunId: null,
        processingRunStateJson: null,
        processingStartedAt: null,
      });

      await prisma.intakeDocument.create({
        data: {
          intakeSessionId: session.id,
          documentId: newDoc.id,
        },
      });
    }
  }

  await getRepository().updateBatchGroup(groupId, {
    status: "confirmed",
    intakeSessionId: session.id,
  });

  const allGroups = batch.groups;
  const allProcessed = allGroups.every((g) => g.id === groupId || g.status !== "pending");
  if (allProcessed) {
    await getRepository().updateBatchStatus(batchId, "confirmed");
  }

  return { session: toIntakeSessionRecord(session), dealId: deal.id };
}

export async function reassignDocumentInBatch(
  viewer: Viewer,
  batchId: string,
  documentId: string,
  fromGroupId: string,
  toGroupId: string
) {
  const batch = await getRepository().getBatch(viewer.id, batchId);
  if (!batch) {
    throw new Error("Batch not found.");
  }

  const fromGroup = batch.groups.find((g) => g.id === fromGroupId);
  const toGroup = batch.groups.find((g) => g.id === toGroupId);

  if (!fromGroup || !toGroup) {
    throw new Error("One or both groups not found.");
  }

  if (!fromGroup.documentIds.includes(documentId)) {
    throw new Error("Document not in source group.");
  }

  await getRepository().updateBatchGroup(fromGroupId, {
    documentIds: fromGroup.documentIds.filter((id) => id !== documentId),
  });

  await getRepository().updateBatchGroup(toGroupId, {
    documentIds: [...toGroup.documentIds, documentId],
  });

  return getRepository().getBatch(viewer.id, batchId);
}
