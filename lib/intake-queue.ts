/**
 * Intake queue claiming and processing kickoff.
 * This file moves sessions from queued to processing and starts document work
 * without blocking the HTTP request on downstream Inngest availability.
 */
import { emitWorkspaceNotificationForSession } from "@/lib/notification-service";
import { prisma } from "@/lib/prisma";
import { safeRevalidateTag } from "@/lib/safe-revalidate";
import type { IntakeSessionRecord } from "@/lib/types";

async function enqueuePendingDocumentsForDeal(dealId: string) {
  const { enqueueDocumentProcessing } = await import("@/lib/deals");
  const documents = await prisma.document.findMany({
    where: {
      dealId,
      processingStatus: "pending"
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  for (const document of documents) {
    await enqueueDocumentProcessing(document.id);
  }

  return documents.length;
}

function startPendingDocumentsForDeal(dealId: string) {
  void enqueuePendingDocumentsForDeal(dealId).catch((error) => {
    console.error("[intake-queue] Could not enqueue pending documents:", error);
  });
}

function toIntakeSessionRecord(session: {
  id: string;
  userId: string;
  dealId: string;
  status: string;
  errorMessage: string | null;
  inputSource: string | null;
  draftBrandName: string | null;
  draftCampaignName: string | null;
  draftNotes: string | null;
  draftPastedText: string | null;
  draftPastedTextTitle: string | null;
  duplicateCheckStatus: string | null;
  duplicateMatchJson: unknown | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
}) {
  return {
    id: session.id,
    userId: session.userId,
    dealId: session.dealId,
    status: session.status as IntakeSessionRecord["status"],
    errorMessage: session.errorMessage,
    inputSource: session.inputSource as IntakeSessionRecord["inputSource"],
    draftBrandName: session.draftBrandName,
    draftCampaignName: session.draftCampaignName,
    draftNotes: session.draftNotes,
    draftPastedText: session.draftPastedText,
    draftPastedTextTitle: session.draftPastedTextTitle,
    duplicateCheckStatus: session.duplicateCheckStatus as IntakeSessionRecord["duplicateCheckStatus"],
    duplicateMatchJson: session.duplicateMatchJson,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    expiresAt: session.expiresAt?.toISOString() ?? null
  } satisfies IntakeSessionRecord;
}

async function claimQueuedSession(where: {
  id?: string;
  userId: string;
  sessionIds?: string[];
}) {
  const nextSession = await prisma.intakeSession.findFirst({
    where: {
      ...(where.id ? { id: where.id } : {}),
      ...(where.sessionIds?.length ? { id: { in: where.sessionIds } } : {}),
      userId: where.userId,
      status: "queued",
      deal: {
        confirmedAt: null
      }
    },
    orderBy: {
      updatedAt: "asc"
    }
  });

  if (!nextSession) {
    return null;
  }

  const claimed = await prisma.intakeSession.updateMany({
    where: {
      id: nextSession.id,
      status: "queued"
    },
    data: {
      status: "processing",
      errorMessage: null
    }
  });

  if (claimed.count === 0) {
    return null;
  }

  return prisma.intakeSession.findUnique({
    where: { id: nextSession.id }
  });
}

export async function startQueuedIntakeSessionById(
  userId: string,
  sessionId: string
): Promise<IntakeSessionRecord | null> {
  const processingSession = await prisma.intakeSession.findFirst({
    where: {
      userId,
      status: "processing",
      deal: {
        confirmedAt: null
      }
    }
  });

  if (processingSession && processingSession.id !== sessionId) {
    throw new Error(
      "Another workspace is already analyzing. Wait for it to finish before starting a different one."
    );
  }

  const claimed = await claimQueuedSession({
    id: sessionId,
    userId
  });

  if (!claimed) {
    const session = await prisma.intakeSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      return null;
    }

    return toIntakeSessionRecord(session);
  }

  startPendingDocumentsForDeal(claimed.dealId);

  // Invalidate cache so the "workspace generating" notification appears immediately
  safeRevalidateTag(`user-${claimed.userId}-deals`);
  safeRevalidateTag(`user-${claimed.userId}-notifications`);
  await emitWorkspaceNotificationForSession(claimed.id, "workspace.processing_started");

  return toIntakeSessionRecord(claimed);
}

export async function startNextQueuedIntakeSessionForUser(
  userId: string,
  sessionIds?: string[]
) {
  const processingSession = await prisma.intakeSession.findFirst({
    where: {
      userId,
      status: "processing",
      deal: {
        confirmedAt: null
      }
    }
  });

  if (processingSession) {
    if (sessionIds?.length && !sessionIds.includes(processingSession.id)) {
      throw new Error(
        "Another workspace is already analyzing. Wait for it to finish before starting a different queue."
      );
    }
    return toIntakeSessionRecord(processingSession);
  }

  const claimed = await claimQueuedSession({
    userId,
    sessionIds
  });

  if (!claimed) {
    return null;
  }

  startPendingDocumentsForDeal(claimed.dealId);
  safeRevalidateTag(`user-${claimed.userId}-deals`);
  safeRevalidateTag(`user-${claimed.userId}-notifications`);
  await emitWorkspaceNotificationForSession(claimed.id, "workspace.processing_started");
  return toIntakeSessionRecord(claimed);
}
