import { prisma } from "@/lib/prisma";
import type { IntakeSessionRecord } from "@/lib/types";

async function enqueuePendingDocumentsForDeal(dealId: string) {
  const { enqueueDocumentProcessing, processDocumentById } = await import(
    "@/lib/deals"
  );
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
    const queue = await enqueueDocumentProcessing(document.id);

    if (queue.mode === "local") {
      void processDocumentById(document.id).catch(() => undefined);
    }
  }

  return documents.length;
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
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt?.toISOString() ?? null
    };
  }

  await enqueuePendingDocumentsForDeal(claimed.dealId);

  return {
    id: claimed.id,
    userId: claimed.userId,
    dealId: claimed.dealId,
    status: claimed.status as IntakeSessionRecord["status"],
    errorMessage: claimed.errorMessage,
    inputSource: claimed.inputSource as IntakeSessionRecord["inputSource"],
    draftBrandName: claimed.draftBrandName,
    draftCampaignName: claimed.draftCampaignName,
    draftNotes: claimed.draftNotes,
    draftPastedText: claimed.draftPastedText,
    draftPastedTextTitle: claimed.draftPastedTextTitle,
    createdAt: claimed.createdAt.toISOString(),
    updatedAt: claimed.updatedAt.toISOString(),
    completedAt: claimed.completedAt?.toISOString() ?? null,
    expiresAt: claimed.expiresAt?.toISOString() ?? null
  };
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
    return processingSession.id;
  }

  const claimed = await claimQueuedSession({
    userId,
    sessionIds
  });

  if (!claimed) {
    return null;
  }

  await enqueuePendingDocumentsForDeal(claimed.dealId);
  return claimed.id;
}
