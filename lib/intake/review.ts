/**
 * Intake review, queue start, retry, and confirmation workflows.
 * This file owns the later-stage intake flow after draft creation and document upload are complete.
 */
import { prisma } from "@/lib/prisma";
import { emitWorkspaceNotificationForCurrentState } from "@/lib/notification-service";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { createPersistedIntakeRecord } from "@/lib/intake-normalization";
import { startNextQueuedIntakeSessionForUser, startQueuedIntakeSessionById } from "@/lib/intake-queue";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import {
  getDealForViewer,
  reprocessDocumentForViewer,
  updateDealForViewer,
  updateTermsForViewer
} from "@/lib/deals";
import type {
  CampaignDateWindow,
  DealAggregate,
  DealCategory,
  DeliverableItem,
  DisclosureObligation,
  IntakeAnalyticsRecord,
  IntakeTimelineItem,
  Viewer
} from "@/lib/types";

import {
  campaignDateWindowFromTimelineItems,
  deriveProcessingSnapshot,
  editableTermsFromAggregate,
  emptyEditableTerms,
  toIntakeSessionRecord
} from "./shared";

export async function getIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string
): Promise<{
  session: import("@/lib/types").IntakeSessionRecord;
  aggregate: DealAggregate | null;
  processing: import("@/lib/types").IntakeProcessingSnapshot;
  profileDefaults: {
    displayName: string | null;
    creatorLegalName: string | null;
    businessName: string | null;
    contactEmail: string | null;
    preferredSignature: string | null;
  } | null;
}> {
  const session = await prisma.intakeSession.findFirst({
    where: {
      id: sessionId,
      userId: viewer.id
    }
  });

  if (!session) {
    throw new Error("Intake session not found.");
  }

  const synced = await syncIntakeSessionForDealId(session.dealId);
  const aggregate = await getDealForViewer(viewer, session.dealId);
  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;

  const nextSession = synced ?? toIntakeSessionRecord(session);

  return {
    session: nextSession,
    aggregate,
    processing: deriveProcessingSnapshot(aggregate, nextSession),
    profileDefaults: profile
      ? {
          displayName: profile.displayName,
          creatorLegalName: profile.creatorLegalName,
          businessName: profile.businessName,
          contactEmail: profile.contactEmail,
          preferredSignature: profile.preferredSignature
        }
      : null
  };
}

export async function startQueuedIntakeAnalysisForViewer(
  viewer: Viewer,
  input?: {
    sessionIds?: string[];
    sessionId?: string;
  }
) {
  const startedSessionId = input?.sessionId
    ? await startQueuedIntakeSessionById(viewer.id, input.sessionId)
    : await startNextQueuedIntakeSessionForUser(viewer.id, input?.sessionIds);

  if (!startedSessionId) {
    throw new Error("There are no queued workspaces ready to analyze.");
  }

  const sessionId =
    typeof startedSessionId === "string" ? startedSessionId : startedSessionId.id;

  const payload = await getIntakeSessionForViewer(viewer, sessionId);
  return payload.session;
}

export async function retryIntakeSessionForViewer(viewer: Viewer, sessionId: string) {
  const session = await prisma.intakeSession.findFirst({
    where: {
      id: sessionId,
      userId: viewer.id
    },
    include: {
      documents: {
        include: { document: true }
      }
    }
  });

  if (!session) {
    throw new Error("Intake session not found.");
  }

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: "processing",
      errorMessage: null
    }
  });

  for (const link of session.documents) {
    await reprocessDocumentForViewer(viewer, link.documentId);
  }

  const synced = await syncIntakeSessionForDealId(session.dealId);
  await emitWorkspaceNotificationForCurrentState(session.id);
  return synced ?? toIntakeSessionRecord(session);
}

// fallow-ignore-next-line complexity
export async function confirmIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    brandName: string;
    contractTitle: string;
    agencyName?: string | null;
    contractSummary?: string | null;
    primaryContactOrganizationType?: "brand" | "agency" | null;
    primaryContactName?: string | null;
    primaryContactTitle?: string | null;
    primaryContactEmail?: string | null;
    primaryContactPhone?: string | null;
    paymentAmount?: number | null;
    currency?: string | null;
    brandCategory?: DealCategory | null;
    competitorCategories?: string[];
    restrictedCategories?: string[];
    campaignDateWindow?: CampaignDateWindow | null;
    disclosureObligations?: DisclosureObligation[];
    deliverables?: DeliverableItem[];
    timelineItems?: IntakeTimelineItem[];
    analytics?: IntakeAnalyticsRecord | null;
    notes?: string | null;
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

  const aggregate = await getDealForViewer(viewer, session.dealId);
  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;

  if (!aggregate) {
    throw new Error("Draft deal not found.");
  }

  if (aggregate.deal.confirmedAt) {
    await prisma.intakeSession.update({
      where: { id: session.id },
      data: {
        status: "completed",
        completedAt: session.completedAt ?? new Date(),
        errorMessage: null
      }
    });
    await emitWorkspaceNotificationForCurrentState(session.id);
    return aggregate;
  }

  if (!["ready_for_confirmation", "failed"].includes(session.status)) {
    throw new Error("This intake session is not ready to confirm yet.");
  }

  await updateDealForViewer(viewer, session.dealId, {
    brandName: input.brandName,
    campaignName: input.contractTitle,
    confirmedAt: new Date().toISOString()
  });

  await updateTermsForViewer(viewer, session.dealId, {
    ...(editableTermsFromAggregate(aggregate) ??
      emptyEditableTerms({
        brandName: aggregate.deal.brandName,
        campaignName: aggregate.deal.campaignName,
        creatorName:
          profile?.creatorLegalName?.trim() ||
          profile?.displayName?.trim() ||
          viewer.displayName,
        notes: null
      })),
    brandName: input.brandName,
    campaignName: input.contractTitle,
    agencyName: input.agencyName?.trim() || null,
    paymentAmount: input.paymentAmount ?? aggregate.terms?.paymentAmount ?? null,
    currency: input.currency?.trim() || aggregate.terms?.currency || null,
    deliverables: input.deliverables ?? aggregate.terms?.deliverables ?? [],
    brandCategory: input.brandCategory ?? aggregate.terms?.brandCategory ?? null,
    competitorCategories:
      input.competitorCategories ?? aggregate.terms?.competitorCategories ?? [],
    restrictedCategories:
      input.restrictedCategories ?? aggregate.terms?.restrictedCategories ?? [],
    campaignDateWindow:
      input.campaignDateWindow ??
      campaignDateWindowFromTimelineItems(input.timelineItems ?? []) ??
      aggregate.terms?.campaignDateWindow ??
      null,
    disclosureObligations:
      input.disclosureObligations ?? aggregate.terms?.disclosureObligations ?? [],
    creatorName:
      aggregate.terms?.creatorName ??
      profile?.creatorLegalName?.trim() ??
      profile?.displayName?.trim() ??
      viewer.displayName,
    notes: input.notes?.trim() || aggregate.terms?.notes || null
  });

  const contractSummary =
    input.contractSummary?.trim() ||
    aggregate.currentSummary?.body?.trim() ||
    aggregate.deal.summary?.trim() ||
    null;
  await getRepository().saveSummary(
    session.dealId,
    null,
    createPersistedIntakeRecord({
      brandName: input.brandName,
      agencyName: input.agencyName?.trim() || null,
      primaryContact: {
        organizationType:
          input.primaryContactOrganizationType ??
          (input.agencyName?.trim() ? "agency" : "brand"),
        name: input.primaryContactName?.trim() || null,
        title: input.primaryContactTitle?.trim() || null,
        email: input.primaryContactEmail?.trim() || null,
        phone: input.primaryContactPhone?.trim() || null
      },
      contractTitle: input.contractTitle,
      contractSummary,
      paymentAmount: input.paymentAmount ?? aggregate.terms?.paymentAmount ?? null,
      currency:
        input.currency?.trim() ||
        aggregate.terms?.currency ||
        aggregate.paymentRecord?.currency ||
        "USD",
      deliverables: input.deliverables ?? aggregate.terms?.deliverables ?? [],
      timelineItems: input.timelineItems ?? [],
      brandCategory: input.brandCategory ?? aggregate.terms?.brandCategory ?? null,
      competitorCategories:
        input.competitorCategories ?? aggregate.terms?.competitorCategories ?? [],
      restrictedCategories:
        input.restrictedCategories ?? aggregate.terms?.restrictedCategories ?? [],
      campaignDateWindow:
        input.campaignDateWindow ??
        campaignDateWindowFromTimelineItems(input.timelineItems ?? []) ??
        aggregate.terms?.campaignDateWindow ??
        null,
      disclosureObligations:
        input.disclosureObligations ?? aggregate.terms?.disclosureObligations ?? [],
      analytics: input.analytics ?? null,
      notes: input.notes?.trim() || aggregate.terms?.notes || null
    })
  );

  await updateDealForViewer(viewer, session.dealId, {
    summary: contractSummary
  });

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null
    }
  });

  await emitWorkspaceNotificationForCurrentState(session.id);

  return getDealForViewer(viewer, session.dealId);
}
