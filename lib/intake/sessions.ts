/**
 * Intake session creation and document upload workflows.
 * This file owns session startup plus follow-up uploads into an existing intake session.
 */
import { prisma } from "@/lib/prisma";
import { emitWorkspaceNotificationForCurrentState } from "@/lib/notification-service";
import { getProfileForViewer } from "@/lib/profile";
import { assertViewerWithinUsageLimit } from "@/lib/billing/entitlements";
import { getRepository } from "@/lib/repository";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import {
  completeDirectDocumentUploadsForViewer,
  registerDirectDocumentUploadsForViewer,
  updateTermsForViewer,
  uploadDocumentsForViewer
} from "@/lib/deals";
import type { DirectUploadFileRegistration, Viewer } from "@/lib/types";

import {
  detectInputSource,
  editableTermsFromAggregate,
  emptyEditableTerms,
  mergeInputSource,
  toIntakeSessionRecord
} from "./shared";

export async function createIntakeSessionForViewer(
  viewer: Viewer,
  input: {
    brandName?: string | null;
    campaignName?: string | null;
    notes?: string | null;
    pastedText?: string | null;
    files?: File[];
  }
) {
  await assertViewerWithinUsageLimit(viewer, "active_workspaces");
  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;
  const files = (input.files ?? []).filter((file) => file.size > 0);
  const pastedText = input.pastedText?.trim() ?? null;

  if (files.length === 0 && !pastedText) {
    throw new Error("Please upload a file or paste document text to start intake.");
  }

  const draftDeal = await getRepository().createDeal(
    viewer.id,
    {
      brandName: input.brandName?.trim() || "Untitled brand",
      campaignName: input.campaignName?.trim() || "Untitled deal"
    },
    { confirmedAt: null }
  );

  const session = await prisma.intakeSession.create({
    data: {
      userId: viewer.id,
      dealId: draftDeal.id,
      status: "queued",
      inputSource: detectInputSource(files, pastedText),
      draftBrandName: input.brandName?.trim() || draftDeal.brandName,
      draftCampaignName: input.campaignName?.trim() || draftDeal.campaignName,
      draftNotes: input.notes?.trim() || null,
      draftPastedText: pastedText,
      draftPastedTextTitle: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    }
  });

  const aggregate = await uploadDocumentsForViewer(viewer, draftDeal.id, {
    files,
    pastedText,
    startProcessing: false
  });

  if (input.notes?.trim()) {
    await updateTermsForViewer(viewer, draftDeal.id, {
      ...(editableTermsFromAggregate(aggregate) ??
        emptyEditableTerms({
          brandName: input.brandName?.trim() || draftDeal.brandName,
          campaignName: input.campaignName?.trim() || draftDeal.campaignName,
          creatorName:
            profile?.creatorLegalName?.trim() ||
            profile?.displayName?.trim() ||
            viewer.displayName,
          notes: null
        })),
      notes: input.notes.trim()
    });
  }

  const documents = await getRepository().listDocuments(viewer.id, draftDeal.id);
  if (documents.length > 0) {
    await prisma.intakeDocument.createMany({
      data: documents.map((document) => ({
        intakeSessionId: session.id,
        documentId: document.id
      })),
      skipDuplicates: true
    });
  }

  const synced = await syncIntakeSessionForDealId(draftDeal.id);
  await emitWorkspaceNotificationForCurrentState(session.id);
  return synced ?? toIntakeSessionRecord(session);
}

export async function appendDocumentsToIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    pastedText?: string | null;
    files?: File[];
    startProcessing?: boolean;
  }
) {
  const session = await prisma.intakeSession.findFirst({
    where: {
      id: sessionId,
      userId: viewer.id
    }
  });

  if (!session) {
    throw new Error("Intake session not found.");
  }

  if (["completed", "expired"].includes(session.status)) {
    throw new Error("This intake session can no longer accept uploads.");
  }

  const files = (input.files ?? []).filter((file) => file.size > 0);
  const pastedText = input.pastedText?.trim() ?? null;

  if (files.length === 0 && !pastedText) {
    throw new Error("Please upload a file or paste document text.");
  }

  const shouldStartProcessing =
    input.startProcessing ??
    ["processing", "uploading"].includes(session.status);

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: "uploading",
      inputSource: mergeInputSource(
        session.inputSource as import("@/lib/types").IntakeSessionRecord["inputSource"] | null,
        detectInputSource(files, pastedText)
      ),
      draftPastedText: pastedText ?? session.draftPastedText,
      draftPastedTextTitle: pastedText ? null : session.draftPastedTextTitle,
      errorMessage: null
    }
  });

  await uploadDocumentsForViewer(viewer, session.dealId, {
    files,
    pastedText,
    startProcessing: shouldStartProcessing
  });

  const documents = await getRepository().listDocuments(viewer.id, session.dealId);
  if (documents.length > 0) {
    await prisma.intakeDocument.createMany({
      data: documents.map((document) => ({
        intakeSessionId: session.id,
        documentId: document.id
      })),
      skipDuplicates: true
    });
  }

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: shouldStartProcessing ? "processing" : "queued",
      errorMessage: null
    }
  });

  const synced = await syncIntakeSessionForDealId(session.dealId);
  await emitWorkspaceNotificationForCurrentState(session.id);
  return synced ?? toIntakeSessionRecord(session);
}

export async function registerDirectDocumentsToIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    files?: DirectUploadFileRegistration[];
    pastedText?: string | null;
  }
) {
  const session = await prisma.intakeSession.findFirst({
    where: {
      id: sessionId,
      userId: viewer.id
    }
  });

  if (!session) {
    throw new Error("Intake session not found.");
  }

  if (["completed", "expired"].includes(session.status)) {
    throw new Error("This intake session can no longer accept uploads.");
  }

  const files = input.files ?? [];
  const pastedText = input.pastedText?.trim() ?? null;

  if (files.length === 0 && !pastedText) {
    throw new Error("Please upload a file or paste document text.");
  }

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: "uploading",
      inputSource: mergeInputSource(
        session.inputSource as import("@/lib/types").IntakeSessionRecord["inputSource"] | null,
        detectInputSource(files.map((file) => ({ size: file.fileSizeBytes })), pastedText)
      ),
      draftPastedText: pastedText ?? session.draftPastedText,
      draftPastedTextTitle: pastedText ? null : session.draftPastedTextTitle,
      errorMessage: null
    }
  });

  const registered = await registerDirectDocumentUploadsForViewer(viewer, session.dealId, {
    files,
    pastedText
  });

  if (registered.mode === "direct" && registered.documents.length > 0) {
    await prisma.intakeDocument.createMany({
      data: registered.documents.map((document) => ({
        intakeSessionId: session.id,
        documentId: document.id
      })),
      skipDuplicates: true
    });
  }

  return {
    session: (await prisma.intakeSession.findUnique({ where: { id: session.id } }))!,
    registration: registered
  };
}

export async function completeDirectDocumentsToIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    succeededDocumentIds: string[];
    failedUploads: Array<{ documentId: string; errorMessage: string }>;
    startProcessing?: boolean;
  }
) {
  const session = await prisma.intakeSession.findFirst({
    where: {
      id: sessionId,
      userId: viewer.id
    }
  });

  if (!session) {
    throw new Error("Intake session not found.");
  }

  if (["completed", "expired"].includes(session.status)) {
    throw new Error("This intake session can no longer accept uploads.");
  }

  await completeDirectDocumentUploadsForViewer(viewer, session.dealId, input);

  const nextStatus =
    input.succeededDocumentIds.length > 0
      ? input.startProcessing === false
        ? "queued"
        : "processing"
      : "failed";
  const errorMessage =
    input.failedUploads.length > 0 && input.succeededDocumentIds.length === 0
      ? input.failedUploads[0]?.errorMessage ?? "Could not upload documents."
      : null;

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: nextStatus,
      errorMessage
    }
  });

  const synced = await syncIntakeSessionForDealId(session.dealId);
  await emitWorkspaceNotificationForCurrentState(session.id);
  return synced ?? toIntakeSessionRecord(session);
}
