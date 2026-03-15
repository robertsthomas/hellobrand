import { prisma } from "@/lib/prisma";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { createPersistedIntakeRecord } from "@/lib/intake-normalization";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import {
  getDealForViewer,
  reprocessDocumentForViewer,
  updateDealForViewer,
  updateTermsForViewer,
  uploadDocumentsForViewer
} from "@/lib/deals";
import type {
  DealAggregate,
  DeliverableItem,
  IntakeAnalyticsRecord,
  IntakeDraftListItem,
  IntakeProcessingSnapshot,
  IntakeSessionRecord,
  IntakeTimelineItem,
  JobRecord,
  JobType,
  Viewer
} from "@/lib/types";

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
  draftBrandName: string | null;
  draftCampaignName: string | null;
  draftNotes: string | null;
  draftPastedText: string | null;
  draftPastedTextTitle: string | null;
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
    draftBrandName: session.draftBrandName,
    draftCampaignName: session.draftCampaignName,
    draftNotes: session.draftNotes,
    draftPastedText: session.draftPastedText,
    draftPastedTextTitle: session.draftPastedTextTitle,
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

function emptyEditableTerms(input: {
  brandName: string;
  campaignName: string;
  creatorName?: string | null;
  notes?: string | null;
}) {
  return {
    brandName: input.brandName,
    agencyName: null,
    creatorName: input.creatorName ?? null,
    campaignName: input.campaignName,
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
    brandCategory: null,
    competitorCategories: [],
    restrictedCategories: [],
    campaignDateWindow: null,
    disclosureObligations: [],
    revisions: null,
    revisionRounds: null,
    termination: null,
    terminationAllowed: null,
    terminationNotice: null,
    terminationConditions: null,
    governingLaw: null,
    notes: input.notes ?? null
  };
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
      brandCategory: aggregate.terms.brandCategory,
      competitorCategories: aggregate.terms.competitorCategories,
      restrictedCategories: aggregate.terms.restrictedCategories,
      campaignDateWindow: aggregate.terms.campaignDateWindow,
      disclosureObligations: aggregate.terms.disclosureObligations,
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

function campaignDateWindowFromTimelineItems(timelineItems: IntakeTimelineItem[]) {
  const datedItems = timelineItems
    .map((item) => item.date)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right));

  if (datedItems.length === 0) {
    return null;
  }

  const startDate = datedItems[0] ?? null;
  const endDate = datedItems[datedItems.length - 1] ?? null;

  return {
    startDate,
    endDate,
    postingWindow:
      startDate && endDate && startDate !== endDate
        ? `${startDate.slice(0, 10)} to ${endDate.slice(0, 10)}`
        : startDate?.slice(0, 10) ?? endDate?.slice(0, 10) ?? null
  };
}

const JOB_STAGE_MAP: Record<JobType, IntakeProcessingSnapshot["currentStage"]> = {
  extract_text: "extracting",
  classify_document: "extracting",
  section_document: "extracting",
  extract_fields: "structuring",
  merge_results: "structuring",
  analyze_risks: "risk_review",
  generate_summary: "summary"
};

const STAGE_META: Record<
  NonNullable<IntakeProcessingSnapshot["currentStage"]>,
  { label: string; description: string }
> = {
  extracting: {
    label: "Extracting source details",
    description: "Parsing files, classifying documents, and isolating sections."
  },
  structuring: {
    label: "Structuring key terms",
    description: "Pulling out payment, deliverables, contacts, rights, and dates."
  },
  risk_review: {
    label: "Reviewing rights and conflicts",
    description: "Checking restrictions, disclosure obligations, and creator risks."
  },
  summary: {
    label: "Preparing review",
    description: "Generating the summary and saving the review-ready workspace draft."
  }
};

function deriveProcessingSnapshot(
  aggregate: DealAggregate | null,
  session: IntakeSessionRecord
): IntakeProcessingSnapshot {
  const jobs = aggregate?.jobs ?? [];
  const processingJob =
    jobs.find((job) => job.status === "processing") ??
    (session.status === "failed" ? jobs.find((job) => job.status === "failed") : null) ??
    null;
  const activeStage =
    (processingJob ? JOB_STAGE_MAP[processingJob.type] : null) ??
    (["ready_for_confirmation", "completed"].includes(session.status) ? "summary" : null);

  const completedStages = Array.from(
    new Set(
      jobs
        .filter((job) => job.status === "ready")
        .map((job) => JOB_STAGE_MAP[job.type])
        .filter((stage): stage is NonNullable<IntakeProcessingSnapshot["currentStage"]> =>
          Boolean(stage)
        )
    )
  );

  if (
    activeStage &&
    ["ready_for_confirmation", "completed"].includes(session.status) &&
    !completedStages.includes(activeStage)
  ) {
    completedStages.push(activeStage);
  }

  const stageMeta = activeStage ? STAGE_META[activeStage] : null;

  return {
    currentStage: activeStage,
    activeJobType: processingJob?.type ?? null,
    activeLabel: stageMeta?.label ?? "Preparing intake",
    activeDescription:
      stageMeta?.description ?? "Waiting for the next document processing step.",
    completedStages
  };
}

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
      status: "uploading",
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
    pastedText
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

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: { status: "processing", errorMessage: null }
  });

  const synced = await syncIntakeSessionForDealId(draftDeal.id);
  return synced ?? toIntakeSessionRecord(session);
}

export async function createDraftIntakeSessionForViewer(
  viewer: Viewer,
  input?: {
    brandName?: string | null;
    campaignName?: string | null;
    notes?: string | null;
  }
) {
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

  return toIntakeSessionRecord(session);
}

export async function appendDocumentsToIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    pastedText?: string | null;
    files?: File[];
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

  await prisma.intakeSession.update({
    where: { id: session.id },
    data: {
      status: "uploading",
      inputSource: detectInputSource(files, pastedText),
      draftPastedText: pastedText,
      draftPastedTextTitle: null,
      errorMessage: null
    }
  });

  await uploadDocumentsForViewer(viewer, session.dealId, {
    files,
    pastedText
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
    data: { status: "processing", errorMessage: null }
  });

  const synced = await syncIntakeSessionForDealId(session.dealId);
  return synced ?? toIntakeSessionRecord(session);
}

export async function updateIntakeDraftForViewer(
  viewer: Viewer,
  sessionId: string,
  input: {
    brandName?: string | null;
    campaignName?: string | null;
    notes?: string | null;
    pastedText?: string | null;
    inputSource?: IntakeSessionRecord["inputSource"];
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
  const sessions = await prisma.intakeSession.findMany({
    where: {
      userId: viewer.id,
      status: {
        in: ["draft", "uploading", "processing", "ready_for_confirmation", "failed"]
      },
      deal: {
        confirmedAt: null
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

  await prisma.intakeSession.delete({
    where: { id: session.id }
  });

  await getRepository().deleteDeal(viewer.id, session.deal.id);
}

export async function getIntakeSessionForViewer(
  viewer: Viewer,
  sessionId: string
): Promise<{
  session: IntakeSessionRecord;
  aggregate: DealAggregate | null;
  processing: IntakeProcessingSnapshot;
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
    contractTitle: string;
    agencyName?: string | null;
    contractSummary?: string | null;
    primaryContactOrganizationType?: "brand" | "agency" | null;
    primaryContactName?: string | null;
    primaryContactTitle?: string | null;
    primaryContactEmail?: string | null;
    primaryContactPhone?: string | null;
    paymentAmount?: number | null;
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
    deliverables:
      input.deliverables && input.deliverables.length > 0
        ? input.deliverables
        : aggregate.terms?.deliverables ?? [],
    brandCategory: aggregate.terms?.brandCategory ?? null,
    competitorCategories: aggregate.terms?.competitorCategories ?? [],
    restrictedCategories: aggregate.terms?.restrictedCategories ?? [],
    campaignDateWindow:
      campaignDateWindowFromTimelineItems(input.timelineItems ?? []) ??
      aggregate.terms?.campaignDateWindow ??
      null,
    disclosureObligations: aggregate.terms?.disclosureObligations ?? [],
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
      currency: aggregate.terms?.currency ?? aggregate.paymentRecord?.currency ?? "USD",
      deliverables:
        input.deliverables && input.deliverables.length > 0
          ? input.deliverables
          : aggregate.terms?.deliverables ?? [],
      timelineItems: input.timelineItems ?? [],
      brandCategory: aggregate.terms?.brandCategory ?? null,
      competitorCategories: aggregate.terms?.competitorCategories ?? [],
      restrictedCategories: aggregate.terms?.restrictedCategories ?? [],
      campaignDateWindow:
        campaignDateWindowFromTimelineItems(input.timelineItems ?? []) ??
        aggregate.terms?.campaignDateWindow ??
        null,
      disclosureObligations: aggregate.terms?.disclosureObligations ?? [],
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

  return getDealForViewer(viewer, session.dealId);
}
