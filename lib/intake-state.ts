import { prisma } from "@/lib/prisma";
import { startNextQueuedIntakeSessionForUser } from "@/lib/intake-queue";
import type { IntakeSessionRecord, IntakeSessionStatus, PaymentStatus } from "@/lib/types";

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toIntakeSessionRecord(session: {
  id: string;
  userId: string;
  dealId: string;
  status: string;
  errorMessage: string | null;
  inputSource: string | null;
  draftBrandName?: string | null;
  draftCampaignName?: string | null;
  draftNotes?: string | null;
  draftPastedText?: string | null;
  draftPastedTextTitle?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
}): IntakeSessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    dealId: session.dealId,
    status: session.status as IntakeSessionStatus,
    errorMessage: session.errorMessage,
    inputSource: (session.inputSource ?? null) as IntakeSessionRecord["inputSource"],
    draftBrandName: session.draftBrandName ?? null,
    draftCampaignName: session.draftCampaignName ?? null,
    draftNotes: session.draftNotes ?? null,
    draftPastedText: session.draftPastedText ?? null,
    draftPastedTextTitle: session.draftPastedTextTitle ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: iso(session.completedAt),
    expiresAt: iso(session.expiresAt)
  };
}

function derivePaymentStatus(status: string, dueDate: Date | null): PaymentStatus {
  if (status === "paid") {
    return "paid";
  }

  if (dueDate && dueDate.getTime() < Date.now()) {
    return "late";
  }

  if (status === "late") {
    return "late";
  }

  return (status as PaymentStatus) ?? "not_invoiced";
}

function deriveIntakeStatus(input: {
  currentStatus: string;
  documentsCount: number;
  hasPending: boolean;
  hasFailed: boolean;
  allReady: boolean;
}) {
  if (input.currentStatus === "completed" || input.currentStatus === "expired") {
    return input.currentStatus as IntakeSessionStatus;
  }

  if (input.documentsCount === 0) {
    return "draft" satisfies IntakeSessionStatus;
  }

  if (input.currentStatus === "queued" && !input.hasFailed) {
    return "queued" satisfies IntakeSessionStatus;
  }

  if (input.hasFailed) {
    return "failed" satisfies IntakeSessionStatus;
  }

  if (input.hasPending) {
    return "processing" satisfies IntakeSessionStatus;
  }

  if (input.allReady) {
    return "ready_for_confirmation" satisfies IntakeSessionStatus;
  }

  return "draft" satisfies IntakeSessionStatus;
}

export async function syncIntakeSessionForDealId(dealId: string) {
  const session = await prisma.intakeSession.findUnique({
    where: { dealId },
    include: {
      deal: {
        include: {
          documents: true,
          paymentRecord: true
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  const documents = session.deal.documents;
  const nextStatus = deriveIntakeStatus({
    currentStatus: session.status,
    documentsCount: documents.length,
    hasPending: documents.some((document) =>
      ["pending", "processing"].includes(document.processingStatus)
    ),
    hasFailed: documents.some((document) => document.processingStatus === "failed"),
    allReady:
      documents.length > 0 &&
      documents.every((document) => document.processingStatus === "ready")
  });

  const errorMessage =
    nextStatus === "failed"
      ? documents.find((document) => document.errorMessage)?.errorMessage ??
        "At least one document could not be processed."
      : null;

  const paymentStatus = session.deal.paymentRecord
    ? derivePaymentStatus(
        session.deal.paymentRecord.status,
        session.deal.paymentRecord.dueDate
      )
    : null;

  await prisma.$transaction([
    prisma.intakeSession.update({
      where: { id: session.id },
      data: {
        status: nextStatus,
        errorMessage,
        completedAt: nextStatus === "completed" ? new Date() : null
      }
    }),
    ...(paymentStatus
      ? [
          prisma.paymentRecord.update({
            where: { dealId },
            data: { status: paymentStatus }
          }),
          prisma.deal.update({
            where: { id: dealId },
            data: { paymentStatus }
          })
        ]
      : [])
  ]);

  if (["ready_for_confirmation", "failed", "completed"].includes(nextStatus)) {
    await startNextQueuedIntakeSessionForUser(session.userId);
  }

  const refreshed = await prisma.intakeSession.findUnique({ where: { id: session.id } });
  return refreshed ? toIntakeSessionRecord(refreshed) : null;
}

export async function getIntakeSessionRecord(sessionId: string) {
  const session = await prisma.intakeSession.findUnique({
    where: { id: sessionId }
  });

  return session ? toIntakeSessionRecord(session) : null;
}
