/**
 * Intake draft editing and listing workflows.
 * This file owns the editable draft state before an intake session is processed or confirmed.
 */
import { prisma } from "@/lib/prisma";
import { emitWorkspaceNotificationForCurrentState } from "@/lib/notification-service";
import { getProfileForViewer } from "@/lib/profile";
import { assertViewerWithinUsageLimit } from "@/lib/billing/entitlements";
import { getRepository } from "@/lib/repository";
import { markWorkspaceCreatedForViewer } from "@/lib/onboarding";
import {
  getDealForViewer,
  updateDealForViewer,
  updateTermsForViewer
} from "@/lib/deals";
import type { IntakeDraftListItem, Viewer } from "@/lib/types";

import {
  editableTermsFromAggregate,
  emptyEditableTerms,
  toIntakeSessionRecord
} from "./shared";

export async function createDraftIntakeSessionForViewer(
  viewer: Viewer,
  input?: {
    brandName?: string | null;
    campaignName?: string | null;
    notes?: string | null;
  }
) {
  await assertViewerWithinUsageLimit(viewer, "active_workspaces");
  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;

  const draftDeal = await getRepository().createDeal(
    viewer.id,
    {
      brandName: input?.brandName?.trim() || "Untitled brand",
      campaignName: input?.campaignName?.trim() || "Untitled deal"
    },
    { confirmedAt: null }
  );

  if (input?.notes?.trim()) {
    await updateTermsForViewer(viewer, draftDeal.id, {
      ...emptyEditableTerms({
        brandName: draftDeal.brandName,
        campaignName: draftDeal.campaignName,
        creatorName:
          profile?.creatorLegalName?.trim() ||
          profile?.displayName?.trim() ||
          viewer.displayName,
        notes: input.notes.trim()
      })
    });
  }

  const session = await prisma.intakeSession.create({
    data: {
      userId: viewer.id,
      dealId: draftDeal.id,
      status: "draft",
      inputSource: null,
      draftBrandName: input?.brandName?.trim() || draftDeal.brandName,
      draftCampaignName: input?.campaignName?.trim() || draftDeal.campaignName,
      draftNotes: input?.notes?.trim() || null,
      draftPastedText: null,
      draftPastedTextTitle: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    }
  });

  await markWorkspaceCreatedForViewer(viewer);

  return toIntakeSessionRecord(session);
}

export async function updateIntakeDraftForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    brandName?: string | null;
    campaignName?: string | null;
    notes?: string | null;
    pastedText?: string | null;
    inputSource?: import("@/lib/types").IntakeSessionRecord["inputSource"];
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

  if (session.status !== "draft") {
    return toIntakeSessionRecord(session);
  }

  const brandName = input.brandName?.trim() || session.draftBrandName || "Untitled brand";
  const campaignName =
    input.campaignName?.trim() || session.draftCampaignName || "Untitled deal";
  const notes = input.notes?.trim() || null;
  const pastedText = input.pastedText?.trim() || null;

  await updateDealForViewer(viewer, session.dealId, {
    brandName,
    campaignName
  });

  const aggregate = await getDealForViewer(viewer, session.dealId);
  await updateTermsForViewer(viewer, session.dealId, {
    ...(editableTermsFromAggregate(aggregate) ??
      emptyEditableTerms({
        brandName,
        campaignName,
        creatorName: viewer.displayName,
        notes
      })),
    brandName,
    campaignName,
    notes
  });

  const updated = await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      draftBrandName: brandName,
      draftCampaignName: campaignName,
      draftNotes: notes,
      draftPastedText: pastedText,
      draftPastedTextTitle: null,
      inputSource: input.inputSource ?? session.inputSource
    }
  });

  return toIntakeSessionRecord(updated);
}

export async function listIntakeDraftsForViewer(
  viewer: Viewer
): Promise<IntakeDraftListItem[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const sessions = await prisma.intakeSession.findMany({
    where: {
      userId: viewer.id,
      status: {
        in: ["draft", "queued", "uploading", "processing", "ready_for_confirmation"]
      },
      deal: {
        confirmedAt: null,
        status: { not: "archived" }
      }
    },
    include: {
      deal: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return sessions.map((session) => ({
    session: toIntakeSessionRecord(session),
    deal: {
      id: session.deal.id,
      brandName: session.deal.brandName,
      campaignName: session.deal.campaignName,
      updatedAt: session.deal.updatedAt.toISOString()
    }
  }));
}

export async function deleteIntakeDraftForViewer(viewer: Viewer, sessionId: string) {
  const session = await prisma.intakeSession.findFirst({
    where: {
      id: sessionId,
      userId: viewer.id
    },
    include: {
      deal: {
        select: {
          id: true,
          confirmedAt: true
        }
      }
    }
  });

  if (!session) {
    throw new Error("Intake session not found.");
  }

  if (session.deal.confirmedAt) {
    throw new Error("Confirmed deals cannot be deleted as drafts.");
  }

  if (session.status === "completed") {
    throw new Error("Completed intake sessions cannot be deleted as drafts.");
  }

  try {
    const { emitWorkspaceNotificationForSession } = await import(
      "@/lib/notification-service"
    );
    await emitWorkspaceNotificationForSession(session.id, "workspace.cancelled");
  } catch {
    // Non-critical
  }

  await prisma.intakeSession.delete({
    where: { id: session.id }
  });

  await getRepository().deleteDeal(viewer.id, session.deal.id);
}
