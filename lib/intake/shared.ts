/**
 * Shared intake helpers and view-model builders.
 * This file holds session record conversion, editable term defaults, and processing snapshot logic used across the intake workflows.
 */
import type {
  CampaignDateWindow,
  DealAggregate,
  DisclosureObligation,
  IntakeProcessingSnapshot,
  IntakeProcessingStageId,
  IntakeSessionRecord,
  IntakeTimelineItem,
  JobType
} from "@/lib/types";

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function toIntakeSessionRecord(session: {
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

export function detectInputSource(
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

export function mergeInputSource(
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

export function emptyEditableTerms(input: {
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
    campaignDateWindow: null as CampaignDateWindow | null,
    disclosureObligations: [] as DisclosureObligation[],
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

export function editableTermsFromAggregate(aggregate: DealAggregate | null) {
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

  if (!aggregate) {
    return null;
  }

  return emptyEditableTerms({
    brandName: aggregate.deal.brandName,
    campaignName: aggregate.deal.campaignName,
    creatorName: aggregate.terms?.creatorName ?? null,
    notes: aggregate.terms?.notes ?? null
  });
}

export function campaignDateWindowFromTimelineItems(timelineItems: IntakeTimelineItem[]) {
  const dates = timelineItems
    .map((item) => item.date)
    .filter((value): value is string => Boolean(value))
    .sort();

  if (dates.length === 0) {
    return null;
  }

  const startDate = dates[0] ?? null;
  const endDate = dates[dates.length - 1] ?? null;

  return {
    startDate,
    endDate,
    postingWindow:
      startDate && endDate && startDate !== endDate
        ? `${startDate} to ${endDate}`
        : startDate ?? endDate ?? null
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
  IntakeProcessingStageId,
  { label: string; description: string }
> = {
  extracting: {
    label: "Extracting source details",
    description: "Reading the source material and identifying the important sections."
  },
  structuring: {
    label: "Structuring key terms",
    description: "Extracting terms, summaries, and key deliverables."
  },
  risk_review: {
    label: "Reviewing rights and conflicts",
    description: "Checking usage rights, exclusivity, and other negotiation risks."
  },
  summary: {
    label: "Preparing your workspace",
    description: "Finishing the workspace so you can confirm the intake details."
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

export function deriveProcessingSnapshot(
  aggregate: DealAggregate | null,
  session: IntakeSessionRecord
): IntakeProcessingSnapshot {
  const processingJob = aggregate?.jobs.find((job) => job.status === "processing") ?? null;
  const completedStages: IntakeProcessingStageId[] = [];

  if (aggregate?.documents.some((document) => Boolean(document.rawText) || Boolean(document.normalizedText))) {
    completedStages.push("extracting");
  }
  if (aggregate?.terms || (aggregate?.extractionResults?.length ?? 0) > 0) {
    completedStages.push("structuring");
  }
  if (aggregate?.riskFlags.length) {
    completedStages.push("risk_review");
  }
  if (session.status === "ready_for_confirmation" || session.status === "completed") {
    completedStages.push("summary");
  }

  const nextStageAfterCompleted =
    STAGE_ORDER.find((stage) => !completedStages.includes(stage)) ??
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
