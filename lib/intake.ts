import { prisma } from "@/lib/prisma";
import { emitWorkspaceNotificationForCurrentState } from "@/lib/notification-service";
import { getProfileForViewer } from "@/lib/profile";
import { assertViewerWithinUsageLimit } from "@/lib/billing/entitlements";
import { getRepository } from "@/lib/repository";
import { createPersistedIntakeRecord } from "@/lib/intake-normalization";
import { startNextQueuedIntakeSessionForUser, startQueuedIntakeSessionById } from "@/lib/intake-queue";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { markWorkspaceCreatedForViewer } from "@/lib/onboarding";
import {
  completeDirectDocumentUploadsForViewer,
  getDealForViewer,
  registerDirectDocumentUploadsForViewer,
  reprocessDocumentForViewer,
  updateDealForViewer,
  updateTermsForViewer,
  uploadDocumentsForViewer
} from "@/lib/deals";
import type {
  CampaignDateWindow,
  DealAggregate,
  DealCategory,
  DirectUploadFileRegistration,
  DeliverableItem,
  DisclosureObligation,
  IntakeAnalyticsRecord,
  IntakeBatchRecord,
  IntakeDraftListItem,
  IntakeProcessingSnapshot,
  IntakeProcessingStageId,
  IntakeSessionRecord,
  IntakeTimelineItem,
  JobRecord,
  JobType,
  Viewer
} from "@/lib/types";
import type { ClusterInput } from "@/lib/intake-clustering";
import { clusterDocuments } from "@/lib/intake-clustering";

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
  duplicateCheckStatus?: string | null;
  duplicateMatchJson?: unknown | null;
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
    duplicateCheckStatus: (session.duplicateCheckStatus ?? null) as IntakeSessionRecord["duplicateCheckStatus"],
    duplicateMatchJson: session.duplicateMatchJson ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: iso(session.completedAt),
    expiresAt: iso(session.expiresAt)
  };
}

function detectInputSource(
  files: Array<{ size: number }>,
  pastedText: string | null | undefined
) {
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

function mergeInputSource(
  existing: IntakeSessionRecord["inputSource"] | null,
  incoming: IntakeSessionRecord["inputSource"] | null
) {
  if (!existing) {
    return incoming;
  }

  if (!incoming) {
    return existing;
  }

  if (existing === incoming) {
    return existing;
  }

  return "mixed" as const;
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
    deliverables: [] as import("@/lib/types").DeliverableItem[],
    usageRights: null,
    usageRightsOrganicAllowed: null,
    usageRightsPaidAllowed: null,
    whitelistingAllowed: null,
    usageDuration: null,
    usageTerritory: null,
    usageChannels: [] as string[],
    exclusivity: null,
    exclusivityApplies: null,
    exclusivityCategory: null,
    exclusivityDuration: null,
    exclusivityRestrictions: null,
    brandCategory: null as import("@/lib/types").DealCategory | null,
    competitorCategories: [] as string[],
    restrictedCategories: [] as string[],
    campaignDateWindow: null as import("@/lib/types").CampaignDateWindow | null,
    disclosureObligations: [] as import("@/lib/types").DisclosureObligation[],
    revisions: null,
    revisionRounds: null,
    termination: null,
    terminationAllowed: null,
    terminationNotice: null,
    terminationConditions: null,
    governingLaw: null,
    notes: input.notes ?? null,
    manuallyEditedFields: [] as string[],
    briefData: null as import("@/lib/types").BriefData | null
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
      notes: aggregate.terms.notes,
      manuallyEditedFields: aggregate.terms.manuallyEditedFields,
      briefData: aggregate.terms.briefData
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

const STAGE_ORDER: IntakeProcessingStageId[] = [
  "extracting",
  "structuring",
  "risk_review",
  "summary"
];

function stageRank(stage: IntakeProcessingStageId | null | undefined) {
  if (!stage) {
    return -1;
  }

  return STAGE_ORDER.indexOf(stage);
}

function deriveProcessingSnapshot(
  aggregate: DealAggregate | null,
  session: IntakeSessionRecord
): IntakeProcessingSnapshot {
  const jobs = aggregate?.jobs ?? [];
  const processingJobs = jobs.filter((job) => job.status === "processing");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const completedStages = Array.from(
    new Set(
      jobs
        .filter((job) => job.status === "ready")
        .map((job) => JOB_STAGE_MAP[job.type])
        .filter((stage): stage is IntakeProcessingStageId => Boolean(stage))
    )
  ).sort((left, right) => stageRank(left) - stageRank(right));

  const processingJob =
    [...processingJobs].sort((left, right) => {
      const stageDelta =
        stageRank(JOB_STAGE_MAP[right.type]) - stageRank(JOB_STAGE_MAP[left.type]);

      if (stageDelta !== 0) {
        return stageDelta;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    })[0] ??
    (session.status === "failed"
      ? [...failedJobs].sort((left, right) => {
          const stageDelta =
            stageRank(JOB_STAGE_MAP[right.type]) - stageRank(JOB_STAGE_MAP[left.type]);

          if (stageDelta !== 0) {
            return stageDelta;
          }

          return right.updatedAt.localeCompare(left.updatedAt);
        })[0] ?? null
      : null);

  const highestCompletedStage =
    completedStages.length > 0 ? completedStages[completedStages.length - 1] : null;
  const nextStageAfterCompleted =
    highestCompletedStage === null
      ? "extracting"
      : STAGE_ORDER[Math.min(stageRank(highestCompletedStage) + 1, STAGE_ORDER.length - 1)] ??
        null;

  const activeStage =
    (processingJob ? JOB_STAGE_MAP[processingJob.type] : null) ??
    (["ready_for_confirmation", "completed"].includes(session.status)
      ? "summary"
      : session.status === "processing"
        ? nextStageAfterCompleted
        : null);

  if (
    activeStage &&
    ["ready_for_confirmation", "completed"].includes(session.status) &&
    !completedStages.includes(activeStage)
  ) {
    completedStages.push(activeStage);
  }

  const stageMeta = activeStage ? STAGE_META[activeStage] : null;
  const isRunning =
    Boolean(processingJob) ||
    session.status === "processing" ||
    session.status === "uploading";

  return {
    currentStage: activeStage,
    activeJobType: processingJob?.type ?? null,
    activeLabel: stageMeta?.label ?? "Preparing intake",
    activeDescription:
      stageMeta?.description ?? "Waiting for the next document processing step.",
    completedStages,
    isRunning
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
        session.inputSource as IntakeSessionRecord["inputSource"] | null,
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
        session.inputSource as IntakeSessionRecord["inputSource"] | null,
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

  // Emit cancelled notification before deleting (needs session data)
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
    startProcessing: false
  });

  const documents = await getRepository().listDocuments(viewer.id, tempDeal.id);

  const clusterInputs: ClusterInput[] = documents.map((doc) => ({
    documentId: doc.id,
    fileName: doc.fileName,
    rawText: doc.rawText ?? "",
    documentKind: doc.documentKind,
    brandHint: null
  }));

  const clusterResult = clusterDocuments(clusterInputs);

  if (clusterResult.groups.length <= 1) {
    const group = clusterResult.groups[0];
    const brandName = group?.label ?? "Untitled brand";

    await getRepository().updateDeal(viewer.id, tempDeal.id, {
      brandName,
      campaignName: brandName
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
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      }
    });

    if (documents.length > 0) {
      await prisma.intakeDocument.createMany({
        data: documents.map((doc) => ({
          intakeSessionId: session.id,
          documentId: doc.id
        })),
        skipDuplicates: true
      });
    }

    const batch = await getRepository().createBatch(
      viewer.id,
      [{
        label: brandName,
        confidence: group?.confidence ?? 0.9,
        documentIds: documents.map((d) => d.id)
      }]
    );

    return batch;
  }

  const batch = await getRepository().createBatch(
    viewer.id,
    clusterResult.groups.map((group) => ({
      label: group.label,
      confidence: group.confidence,
      documentIds: group.documentIds
    }))
  );

  return batch;
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
      campaignName: input.campaignName.trim() || group.label
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
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    }
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
        processingStartedAt: null
      });

      await prisma.intakeDocument.create({
        data: {
          intakeSessionId: session.id,
          documentId: newDoc.id
        }
      });
    }
  }

  await getRepository().updateBatchGroup(groupId, {
    status: "confirmed",
    intakeSessionId: session.id
  });

  const allGroups = batch.groups;
  const allProcessed = allGroups.every(
    (g) => g.id === groupId || g.status !== "pending"
  );
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
    documentIds: fromGroup.documentIds.filter((id) => id !== documentId)
  });

  await getRepository().updateBatchGroup(toGroupId, {
    documentIds: [...toGroup.documentIds, documentId]
  });

  return getRepository().getBatch(viewer.id, batchId);
}
