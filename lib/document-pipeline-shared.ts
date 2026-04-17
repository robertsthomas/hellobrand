import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { mergeExtractionResults } from "@/lib/analysis/fallback";
import {
  buildConflictIntelligencePatch,
  mergeConflictIntelligence
} from "@/lib/conflict-intelligence";
import { sanitizeCampaignName, sanitizePartyName } from "@/lib/party-labels";
import { sanitizePlainTextInput } from "@/lib/utils";
export {
  createDocumentProcessingRunState,
  DOCUMENT_PIPELINE_STEPS,
  getDocumentProcessingRunState,
  isDocumentPipelineStepComplete,
  markDocumentPipelineRunFailed,
  markDocumentPipelineStepComplete
} from "@/lib/document-pipeline-run-state";
import { getProfileForViewer } from "@/lib/profile";
import type {
  BriefData,
  DealRecord,
  DealTermsRecord,
  DocumentRecord,
  DocumentSectionRecord,
  ExtractionEvidenceRecord,
  ExtractionPipelineResult,
  ExtractionResultRecord,
  RiskFlagRecord,
  Viewer
} from "@/lib/types";

export function createEmptyTerms(
  deal:
    | Pick<DealRecord, "brandName" | "campaignName">
    | { brandName: string | null; campaignName: string | null }
): Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt"> {
  return {
    brandName: deal.brandName,
    agencyName: null,
    creatorName: null,
    campaignName: deal.campaignName,
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
    notes: null,
    manuallyEditedFields: [],
    briefData: null,
    pendingExtraction: null
  };
}

export async function getPreferredCreatorNameForViewer(viewer: Viewer) {
  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;

  return (
    profile?.creatorLegalName?.trim() ||
    profile?.displayName?.trim() ||
    viewer.displayName
  );
}

export function withPreferredCreatorName<
  T extends Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>
>(terms: T, creatorName: string) {
  if (terms.creatorName === creatorName) {
    return terms;
  }

  return {
    ...terms,
    creatorName
  };
}

function sanitizeCreatorExtractionResult(
  extraction: ExtractionPipelineResult,
  creatorName: string
): ReturnType<typeof mergeExtractionResults> {
  const brandName = sanitizePartyName(extraction.data.brandName, "brand");
  const agencyName = sanitizePartyName(extraction.data.agencyName, "agency");
  const campaignName = sanitizeCampaignName(extraction.data.campaignName);

  return {
    ...extraction,
    confidence: extraction.confidence ?? 0.68,
    data: {
      ...extraction.data,
      brandName,
      campaignName,
      agencyName:
        agencyName &&
        (!brandName || agencyName.toLowerCase() !== brandName.toLowerCase())
          ? agencyName
          : null,
      deliverables: (extraction.data.deliverables ?? []).map((item) => ({
        ...item,
        description: item.description ? sanitizePlainTextInput(item.description) : item.description
      })),
      creatorName,
      pendingExtraction: null
    },
    evidence: (Array.isArray(extraction.evidence) ? extraction.evidence : []).filter(
      (entry) => entry.fieldPath !== "creatorName"
    ),
    conflicts: (Array.isArray(extraction.conflicts) ? extraction.conflicts : []).filter(
      (fieldPath) => fieldPath !== "creatorName"
    )
  };
}

export function finalizeDocumentExtraction(
  text: string,
  extraction: ExtractionPipelineResult,
  creatorName: string
) {
  const sanitizedExtraction = sanitizeCreatorExtractionResult(extraction, creatorName);
  const intelligence = buildConflictIntelligencePatch({
    text,
    sectionKey: null,
    fallbackTerms: sanitizedExtraction.data
  });

  sanitizedExtraction.data = {
    ...sanitizedExtraction.data,
    ...mergeConflictIntelligence(sanitizedExtraction.data, intelligence.patch)
  };
  sanitizedExtraction.evidence = [
    ...sanitizedExtraction.evidence,
    ...intelligence.evidence
  ];

  return sanitizedExtraction;
}

function mergeDeliverables(
  existing: NonNullable<DealTermsRecord["deliverables"]>,
  incoming: NonNullable<DealTermsRecord["deliverables"]>
) {
  const map = new Map<string, (typeof existing)[number]>();
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];

  for (const item of safeExisting) {
    map.set(`${item.title}:${item.dueDate ?? "none"}`, item);
  }

  for (const item of safeIncoming) {
    map.set(`${item.title}:${item.dueDate ?? "none"}`, item);
  }

  return Array.from(map.values()).sort((left, right) =>
    (left.dueDate ?? "").localeCompare(right.dueDate ?? "")
  );
}

function mergeBriefData(base: BriefData | null, patch: BriefData | null): BriefData | null {
  if (!base) return patch;
  if (!patch) return base;

  return {
    campaignOverview: patch.campaignOverview ?? base.campaignOverview,
    campaignCode: patch.campaignCode ?? base.campaignCode,
    jobNumber: patch.jobNumber ?? base.jobNumber,
    referenceId: patch.referenceId ?? base.referenceId,
    campaignObjective: patch.campaignObjective ?? base.campaignObjective,
    messagingPoints: patch.messagingPoints.length > 0 ? patch.messagingPoints : base.messagingPoints,
    talkingPoints: patch.talkingPoints.length > 0 ? patch.talkingPoints : base.talkingPoints,
    creativeConceptOverview: patch.creativeConceptOverview ?? base.creativeConceptOverview,
    requiredClaims: patch.requiredClaims && patch.requiredClaims.length > 0 ? patch.requiredClaims : base.requiredClaims,
    contentPillars: patch.contentPillars && patch.contentPillars.length > 0 ? patch.contentPillars : base.contentPillars,
    requiredElements: patch.requiredElements && patch.requiredElements.length > 0 ? patch.requiredElements : base.requiredElements,
    brandGuidelines: patch.brandGuidelines ?? base.brandGuidelines,
    approvalRequirements: patch.approvalRequirements ?? base.approvalRequirements,
    revisionRequirements: patch.revisionRequirements ?? base.revisionRequirements,
    targetAudience: patch.targetAudience ?? base.targetAudience,
    toneAndStyle: patch.toneAndStyle ?? base.toneAndStyle,
    visualDirection: patch.visualDirection ?? base.visualDirection,
    doNotMention: patch.doNotMention.length > 0 ? patch.doNotMention : base.doNotMention,
    productName: patch.productName ?? base.productName,
    productDescription: patch.productDescription ?? base.productDescription,
    deliverablesSummary: patch.deliverablesSummary ?? base.deliverablesSummary,
    deliverablePlatforms: patch.deliverablePlatforms && patch.deliverablePlatforms.length > 0 ? patch.deliverablePlatforms : base.deliverablePlatforms,
    creatorHandle: patch.creatorHandle ?? base.creatorHandle,
    postingSchedule: patch.postingSchedule ?? base.postingSchedule,
    agreementStartDate: patch.agreementStartDate ?? base.agreementStartDate,
    agreementEndDate: patch.agreementEndDate ?? base.agreementEndDate,
    executionTargetDate: patch.executionTargetDate ?? base.executionTargetDate,
    conceptDueDate: patch.conceptDueDate ?? base.conceptDueDate,
    campaignLiveDate: patch.campaignLiveDate ?? base.campaignLiveDate,
    campaignFlight: patch.campaignFlight ?? base.campaignFlight,
    draftDueDate: patch.draftDueDate ?? base.draftDueDate,
    contentDueDate: patch.contentDueDate ?? base.contentDueDate,
    postDuration: patch.postDuration ?? base.postDuration,
    amplificationPeriod: patch.amplificationPeriod ?? base.amplificationPeriod,
    usageNotes: patch.usageNotes ?? base.usageNotes,
    disclosureRequirements: patch.disclosureRequirements && patch.disclosureRequirements.length > 0 ? patch.disclosureRequirements : base.disclosureRequirements,
    competitorRestrictions: patch.competitorRestrictions && patch.competitorRestrictions.length > 0 ? patch.competitorRestrictions : base.competitorRestrictions,
    linksAndAssets: patch.linksAndAssets && patch.linksAndAssets.length > 0 ? patch.linksAndAssets : base.linksAndAssets,
    promoCode: patch.promoCode ?? base.promoCode,
    paymentSchedule: patch.paymentSchedule ?? base.paymentSchedule,
    paymentRequirements: patch.paymentRequirements ?? base.paymentRequirements,
    paymentNotes: patch.paymentNotes ?? base.paymentNotes,
    reportingRequirements: patch.reportingRequirements ?? base.reportingRequirements,
    campaignNotes: patch.campaignNotes ?? base.campaignNotes,
    brandContactName: patch.brandContactName ?? base.brandContactName,
    brandContactTitle: patch.brandContactTitle ?? base.brandContactTitle,
    brandContactEmail: patch.brandContactEmail ?? base.brandContactEmail,
    brandContactPhone: patch.brandContactPhone ?? base.brandContactPhone,
    agencyContactName: patch.agencyContactName ?? base.agencyContactName,
    agencyContactTitle: patch.agencyContactTitle ?? base.agencyContactTitle,
    agencyContactEmail: patch.agencyContactEmail ?? base.agencyContactEmail,
    agencyContactPhone: patch.agencyContactPhone ?? base.agencyContactPhone,
    sourceDocumentIds: Array.from(new Set([...base.sourceDocumentIds, ...patch.sourceDocumentIds]))
  };
}

export function mergeTerms(
  base: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">,
  patch: Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>,
  options?: { manuallyEditedFields?: string[] }
) {
  const manuallyEdited = options?.manuallyEditedFields ?? base.manuallyEditedFields ?? [];
  const baseUsageChannels = Array.isArray(base.usageChannels) ? base.usageChannels : [];
  const patchUsageChannels = Array.isArray(patch.usageChannels) ? patch.usageChannels : [];

  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => {
        if (manuallyEdited.includes(key)) {
          return false;
        }

        if (
          key === "deliverables" ||
          key === "usageChannels" ||
          key === "competitorCategories" ||
          key === "restrictedCategories" ||
          key === "disclosureObligations" ||
          key === "campaignDateWindow" ||
          key === "manuallyEditedFields" ||
          key === "briefData"
        ) {
          return false;
        }

        if (typeof value === "string") {
          return value.trim().length > 0;
        }

        if (typeof value === "number" || typeof value === "boolean") {
          return true;
        }

        return value !== undefined && value !== null;
      })
    ),
    deliverables: mergeDeliverables(base.deliverables, patch.deliverables ?? []),
    usageChannels: Array.from(new Set([...baseUsageChannels, ...patchUsageChannels])),
    manuallyEditedFields: manuallyEdited,
    briefData: mergeBriefData(base.briefData ?? null, patch.briefData ?? null),
    ...mergeConflictIntelligence(base, patch)
  };
}

export function earliestDeliverableDate(terms: Pick<DealTermsRecord, "deliverables">) {
  return (
    [...terms.deliverables]
      .filter((item) => item.dueDate)
      .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""))[0]
      ?.dueDate ?? null
  );
}

function shouldLogDocumentPipeline() {
  return (
    process.env.DEBUG_DOCUMENT_PIPELINE === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

export function logDocumentPipeline(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (!shouldLogDocumentPipeline()) {
    return;
  }

  const logger = level === "error" ? console.error : console.info;
  logger(`[document-pipeline] ${event}`, {
    ...details,
    at: new Date().toISOString()
  });
}

export function writeGenerationSnapshot(input: {
  dealId: string;
  documentId: string;
  fileName: string;
  documentKind: string;
  model: string;
  durationMs: number;
  extraction: ExtractionPipelineResult;
  risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>;
  summary: { body: string; version: string } | null;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const dir = join(process.cwd(), "generations");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}_${input.fileName.replace(/[^a-zA-Z0-9]/g, "_")}.json`;

  writeFileSync(
    join(dir, fileName),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dealId: input.dealId,
        documentId: input.documentId,
        fileName: input.fileName,
        documentKind: input.documentKind,
        model: input.model,
        durationMs: input.durationMs,
        extraction: input.extraction,
        risks: input.risks,
        summary: input.summary
      },
      null,
      2
    )
  );
}

export function reconstructExtractionPipelineResult(input: {
  result: ExtractionResultRecord;
  evidence: ExtractionEvidenceRecord[];
  sections: DocumentSectionRecord[];
}): ExtractionPipelineResult {
  const sectionById = new Map(input.sections.map((section) => [section.id, section]));

  return {
    schemaVersion: input.result.schemaVersion,
    model: input.result.model,
    confidence: input.result.confidence,
    data: input.result.data,
    conflicts: input.result.conflicts,
    evidence: input.evidence.map((entry) => ({
      fieldPath: entry.fieldPath,
      snippet: entry.snippet,
      sectionKey: entry.sectionId
        ? `section:${sectionById.get(entry.sectionId)?.chunkIndex ?? ""}`.replace(/:$/, "")
        : null,
      confidence: entry.confidence
    }))
  };
}
