import { prisma } from "@/lib/prisma";
import { getRepository } from "@/lib/repository";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import {
  getDealForViewer,
  reprocessDocumentForViewer,
  updateDealForViewer,
  updateTermsForViewer,
  uploadDocumentsForViewer
} from "@/lib/deals";
import type { DealAggregate, IntakeSessionRecord, Viewer } from "@/lib/types";

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
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
}): IntakeSessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    dealId: session.dealId,
    status: session.status as IntakeSessionRecord["status"],
    errorMessage: session.errorMessage,
    inputSource: (session.inputSource ?? null) as IntakeSessionRecord["inputSource"],
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: iso(session.completedAt),
    expiresAt: iso(session.expiresAt)
  };
}

function detectInputSource(files: File[], pastedText: string | null | undefined) {
  const hasFiles = files.length > 0;
  const hasPastedText = Boolean(pastedText?.trim());

  if (hasFiles && hasPastedText) {
    return "mixed" as const;
  }

  if (hasFiles) {
    return "upload" as const;
  }

  if (hasPastedText) {
    return "paste" as const;
  }

  return null;
}

function editableTermsFromAggregate(aggregate: DealAggregate | null) {
  if (aggregate?.terms) {
    return {
      brandName: aggregate.terms.brandName,
      agencyName: aggregate.terms.agencyName,
      creatorName: aggregate.terms.creatorName,
      campaignName: aggregate.terms.campaignName,
      paymentAmount: aggregate.terms.paymentAmount,
      currency: aggregate.terms.currency,
      paymentTerms: aggregate.terms.paymentTerms,
      paymentStructure: aggregate.terms.paymentStructure,
      netTermsDays: aggregate.terms.netTermsDays,
      paymentTrigger: aggregate.terms.paymentTrigger,
      deliverables: aggregate.terms.deliverables,
      usageRights: aggregate.terms.usageRights,
      usageRightsOrganicAllowed: aggregate.terms.usageRightsOrganicAllowed,
      usageRightsPaidAllowed: aggregate.terms.usageRightsPaidAllowed,
      whitelistingAllowed: aggregate.terms.whitelistingAllowed,
      usageDuration: aggregate.terms.usageDuration,
      usageTerritory: aggregate.terms.usageTerritory,
      usageChannels: aggregate.terms.usageChannels,
      exclusivity: aggregate.terms.exclusivity,
      exclusivityApplies: aggregate.terms.exclusivityApplies,
      exclusivityCategory: aggregate.terms.exclusivityCategory,
      exclusivityDuration: aggregate.terms.exclusivityDuration,
      exclusivityRestrictions: aggregate.terms.exclusivityRestrictions,
      revisions: aggregate.terms.revisions,
      revisionRounds: aggregate.terms.revisionRounds,
      termination: aggregate.terms.termination,
      terminationAllowed: aggregate.terms.terminationAllowed,
      terminationNotice: aggregate.terms.terminationNotice,
      terminationConditions: aggregate.terms.terminationConditions,
      governingLaw: aggregate.terms.governingLaw,
      notes: aggregate.terms.notes
    };
  }

  return null;
}

export async function createIntakeSessionForViewer(
  viewer: Viewer,
  input: {
    brandName?: string | null;
    campaignName?: string | null;
    notes?: string | null;
    pastedText?: string | null;
    pastedTextTitle?: string | null;
    files?: File[];
  }
) {
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
      status: "uploading",
      inputSource: detectInputSource(files, pastedText),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    }
  });

  const aggregate = await uploadDocumentsForViewer(viewer, draftDeal.id, {
    files,
    pastedText,
    pastedTextTitle: input.pastedTextTitle?.trim() ?? null
  });

  if (input.notes?.trim()) {
    await updateTermsForViewer(viewer, draftDeal.id, {
      ...(editableTermsFromAggregate(aggregate) ?? {
        brandName: input.brandName?.trim() || draftDeal.brandName,
        agencyName: null,
        creatorName: null,
        campaignName: input.campaignName?.trim() || draftDeal.campaignName,
        paymentAmount: null,
        currency: null,
        paymentTerms: null,
        paymentStructure: null,
        netTermsDays: null,
        paymentTrigger: null,
        deliverables: [],
        usageRights: null,
        usageRightsOrganicAllowed: null,
        usageRightsPaidAllowed: null,
        whitelistingAllowed: null,
        usageDuration: null,
        usageTerritory: null,
        usageChannels: [],
        exclusivity: null,
        exclusivityApplies: null,
        exclusivityCategory: null,
        exclusivityDuration: null,
        exclusivityRestrictions: null,
        revisions: null,
        revisionRounds: null,
        termination: null,
        terminationAllowed: null,
        terminationNotice: null,
        terminationConditions: null,
        governingLaw: null,
        notes: null
      }),
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

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: { status: "processing", errorMessage: null }
  });

  const synced = await syncIntakeSessionForDealId(draftDeal.id);
  return synced ?? toIntakeSessionRecord(session);
}

export async function getIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string
): Promise<{
  session: IntakeSessionRecord;
  aggregate: DealAggregate | null;
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

  return {
    session: synced ?? toIntakeSessionRecord(session),
    aggregate
  };
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
  return synced ?? toIntakeSessionRecord(session);
}

export async function confirmIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    brandName: string;
    campaignName: string;
    agencyName?: string | null;
    paymentAmount?: number | null;
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

  if (!aggregate) {
    throw new Error("Draft deal not found.");
  }

  await updateDealForViewer(viewer, session.dealId, {
    brandName: input.brandName,
    campaignName: input.campaignName,
    confirmedAt: new Date().toISOString()
  });

  await updateTermsForViewer(viewer, session.dealId, {
    ...(editableTermsFromAggregate(aggregate) ?? {
      brandName: aggregate.deal.brandName,
      agencyName: null,
      creatorName: null,
      campaignName: aggregate.deal.campaignName,
      paymentAmount: null,
      currency: "USD",
      paymentTerms: null,
      paymentStructure: null,
      netTermsDays: null,
      paymentTrigger: null,
      deliverables: [],
      usageRights: null,
      usageRightsOrganicAllowed: null,
      usageRightsPaidAllowed: null,
      whitelistingAllowed: null,
      usageDuration: null,
      usageTerritory: null,
      usageChannels: [],
      exclusivity: null,
      exclusivityApplies: null,
      exclusivityCategory: null,
      exclusivityDuration: null,
      exclusivityRestrictions: null,
      revisions: null,
      revisionRounds: null,
      termination: null,
      terminationAllowed: null,
      terminationNotice: null,
      terminationConditions: null,
      governingLaw: null,
      notes: null
    }),
    brandName: input.brandName,
    campaignName: input.campaignName,
    agencyName: input.agencyName?.trim() || null,
    paymentAmount: input.paymentAmount ?? aggregate.terms?.paymentAmount ?? null,
    notes: input.notes?.trim() || aggregate.terms?.notes || null
  });

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null
    }
  });

  return getDealForViewer(viewer, session.dealId);
}
