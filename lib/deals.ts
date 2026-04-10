import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { getViewerById } from "@/lib/auth";
import {
  buildConflictResults,
  dealCategoryLabel,
  mergeConflictIntelligence
} from "@/lib/conflict-intelligence";
import { generateEmailDraft } from "@/lib/email/generate";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { syncPaymentRecordForDeal } from "@/lib/payments";
import {
  assertViewerWithinUsageLimit,
  recordViewerUsage
} from "@/lib/billing/entitlements";
import {
  emitNotificationSeedForUser
} from "@/lib/notification-service";
import { getProfileForViewer } from "@/lib/profile";
import { getRepository } from "@/lib/repository";
import { buildGeneratedSummaryVariant } from "@/lib/summary-variants";
import {
  createSignedUploadTarget,
  storeUploadedBytes,
  supportsDirectStorageUploads
} from "@/lib/storage";
import {
  getLatestSummaryByType
} from "@/lib/summaries";
import {
  buildAppliedTerms,
  coalesceExtractions,
  hasMeaningfulChanges
} from "@/lib/pending-changes";
import {
  createDocumentProcessingRunState
} from "@/lib/document-pipeline-shared";
import {
  DocumentRunSupersededError,
  failDocumentProcessingRun,
  getDocumentPipelineFailedStep,
  runDocumentPipelineSteps
} from "@/lib/pipeline-steps";
import type {
  BriefData,
  DealAggregate,
  DealRecord,
  DealTermsRecord,
  DocumentKind,
  DocumentRecord,
  DraftIntent,
  ExtractionPipelineResult,
  JobType,
  PendingExtractionData,
  RiskFlagRecord,
  SummaryType,
  Viewer
} from "@/lib/types";

async function queueAssistantSnapshotRefresh(viewer: Viewer, dealId?: string | null) {
  const { refreshAssistantSnapshotsForViewer } = await import("@/lib/assistant/snapshots");
  await refreshAssistantSnapshotsForViewer(viewer, { dealId });
}

function createEmptyTerms(
  deal: Pick<DealRecord, "brandName" | "campaignName">
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

async function getPreferredCreatorNameForViewer(viewer: Viewer) {
  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;

  return (
    profile?.creatorLegalName?.trim() ||
    profile?.displayName?.trim() ||
    viewer.displayName
  );
}

function withPreferredCreatorName<
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

async function hydrateProfileBackedCreatorName(
  viewer: Viewer,
  aggregate: DealAggregate
) {
  const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
  const nextTerms = withPreferredCreatorName(
    aggregate.terms ?? createEmptyTerms(aggregate.deal),
    preferredCreatorName
  );

  const persistedTerms =
    aggregate.terms?.creatorName === preferredCreatorName
      ? aggregate.terms
      : await getRepository().upsertTerms(aggregate.deal.id, nextTerms);

  return {
    ...aggregate,
    terms: persistedTerms,
    extractionResults: aggregate.extractionResults.map((result) => ({
      ...result,
      data: withPreferredCreatorName(result.data, preferredCreatorName),
      conflicts: (Array.isArray(result.conflicts) ? result.conflicts : []).filter(
        (fieldPath) => fieldPath !== "creatorName"
      )
    })),
    extractionEvidence: aggregate.extractionEvidence.filter(
      (entry) => entry.fieldPath !== "creatorName"
    )
  };
}

function detectChangedFields(
  base: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">,
  patch: Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>
): string[] {
  const changed: string[] = [];
  const skip = new Set(["deliverables", "usageChannels", "competitorCategories", "restrictedCategories", "disclosureObligations", "campaignDateWindow", "manuallyEditedFields"]);

  for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
    if (skip.has(key)) continue;
    const baseVal = base[key];
    const patchVal = patch[key];
    if (patchVal === null || patchVal === undefined) continue;
    if (typeof patchVal === "string" && patchVal.trim().length === 0) continue;
    if (baseVal !== patchVal) {
      changed.push(key);
    }
  }

  return changed;
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

function mergeBriefData(
  base: BriefData | null,
  patch: BriefData | null
): BriefData | null {
  if (!base) return patch;
  if (!patch) return base;

  return {
    campaignOverview: patch.campaignOverview ?? base.campaignOverview,
    campaignObjective: patch.campaignObjective ?? base.campaignObjective,
    messagingPoints: patch.messagingPoints.length > 0 ? patch.messagingPoints : base.messagingPoints,
    talkingPoints: patch.talkingPoints.length > 0 ? patch.talkingPoints : base.talkingPoints,
    creativeConceptOverview: patch.creativeConceptOverview ?? base.creativeConceptOverview,
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
    postingSchedule: patch.postingSchedule ?? base.postingSchedule,
    campaignLiveDate: patch.campaignLiveDate ?? base.campaignLiveDate,
    draftDueDate: patch.draftDueDate ?? base.draftDueDate,
    contentDueDate: patch.contentDueDate ?? base.contentDueDate,
    usageNotes: patch.usageNotes ?? base.usageNotes,
    disclosureRequirements: patch.disclosureRequirements && patch.disclosureRequirements.length > 0 ? patch.disclosureRequirements : base.disclosureRequirements,
    competitorRestrictions: patch.competitorRestrictions && patch.competitorRestrictions.length > 0 ? patch.competitorRestrictions : base.competitorRestrictions,
    linksAndAssets: patch.linksAndAssets && patch.linksAndAssets.length > 0 ? patch.linksAndAssets : base.linksAndAssets,
    promoCode: patch.promoCode ?? base.promoCode,
    paymentNotes: patch.paymentNotes ?? base.paymentNotes,
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

function inferPastedTextFileName(text: string) {
  const lower = text.toLowerCase();
  const subjectLine = text
    .match(/^subject:\s*(.+)$/im)?.[1]
    ?.replace(/^(re|fwd?):\s*/gi, "")
    ?.trim();
  const campaignLine = text.match(/^(?:campaign|project)\s*:\s*(.+)$/im)?.[1]?.trim();

  const normalizedTitle = (subjectLine || campaignLine || "")
    .replace(/[^\w\s&+.'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedTitle) {
    return `${normalizedTitle}.txt`;
  }

  if (
    /(^|\n)\s*(from|to|subject|cc):|\b(sent from my iphone|thanks,|best,|regards,)\b/.test(
      lower
    )
  ) {
    return "pasted-email-thread.txt";
  }

  if (
    /deliverables|posting schedule|content requirements|assets?|stories|reels|tiktok|youtube/.test(
      lower
    )
  ) {
    return "pasted-deliverables-notes.txt";
  }

  if (/invoice|payment due|net ?\d+|balance due/.test(lower)) {
    return "pasted-invoice.txt";
  }

  if (
    /agreement|contract|usage rights|exclusivity|term and termination|governing law|indemnif/.test(
      lower
    )
  ) {
    return "pasted-contract.txt";
  }

  if (/campaign brief|brief overview|key messaging|content pillars/.test(lower)) {
    return "pasted-campaign-brief.txt";
  }

  return "pasted-context.txt";
}

function earliestDeliverableDate(terms: Pick<DealTermsRecord, "deliverables">) {
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

function logDocumentPipeline(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (!shouldLogDocumentPipeline()) {
    return;
  }

  const logger = level === "error" ? console.error : console.info;
  logger(`[document-pipeline] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
}

async function runStage<T>(
  dealId: string,
  documentId: string,
  type: JobType,
  work: () => Promise<T>
) {
  const repository = getRepository();
  const job = await repository.createJob({
    dealId,
    documentId,
    type,
    status: "processing",
    attemptCount: 1,
    failureReason: null
  });
  const startedAt = Date.now();

  logDocumentPipeline("info", "stage_start", {
    dealId,
    documentId,
    stage: type,
    jobId: job.id
  });

  try {
    const result = await work();
    await repository.updateJob(job.id, {
      status: "ready",
      failureReason: null
    });
    logDocumentPipeline("info", "stage_complete", {
      dealId,
      documentId,
      stage: type,
      jobId: job.id,
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document processing failed.";
    await repository.updateJob(job.id, {
      status: "failed",
      failureReason: message
    });
    logDocumentPipeline("error", "stage_failed", {
      dealId,
      documentId,
      stage: type,
      jobId: job.id,
      durationMs: Date.now() - startedAt,
      error: message
    });
    throw new Error(`${type}: ${message}`);
  }
}

function writeGenerationSnapshot(input: {
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

async function processDocumentPipeline(
  _viewer: Viewer,
  document: DocumentRecord,
  runId: string
) {
  return runDocumentPipelineSteps(document.id, runId);
}

async function startDocumentProcessingRun(documentId: string) {
  const repository = getRepository();
  const document = await repository.getDocument(documentId);

  if (!document) {
    throw new Error("Document not found.");
  }

  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  if (document.processingRunId) {
    await repository.updateDocumentRun(document.processingRunId, {
      status: "superseded"
    });
  }

  await repository.createDocumentRun({
    id: runId,
    documentId,
    status: "pending",
    stepStateJson: createDocumentProcessingRunState(runId),
    startedAt,
    completedAt: null,
    failedAt: null,
    failureMessage: null
  });

  await repository.updateDocument(documentId, {
    processingStatus: "pending",
    errorMessage: null,
    processingRunId: runId,
    processingRunStateJson: createDocumentProcessingRunState(runId),
    processingStartedAt: startedAt
  });

  return { runId, documentId };
}

export async function enqueueDocumentProcessing(documentId: string) {
  const startedRun = await startDocumentProcessingRun(documentId);
  const eventKey = process.env.INNGEST_EVENT_KEY;

  if (eventKey) {
    try {
      const { inngest } = await import("@/lib/inngest/client");
      await inngest.send({
        name: "document/process.requested",
        data: { documentId, runId: startedRun.runId }
      });
      logDocumentPipeline("info", "queue_enqueued", {
        documentId,
        runId: startedRun.runId,
        mode: "inngest"
      });
      return { mode: "inngest" as const, runId: startedRun.runId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to enqueue Inngest event.";
      logDocumentPipeline("error", "inngest_enqueue_failed", {
        documentId,
        runId: startedRun.runId,
        error: message
      });
    }
  }

  logDocumentPipeline("info", "queue_enqueued", {
    documentId,
    runId: startedRun.runId,
    mode: "local"
  });
  return { mode: "local" as const, runId: startedRun.runId };
}

export async function processDocumentById(documentId: string, runId?: string) {
  const repository = getRepository();
  const document = await repository.getDocument(documentId);

  if (!document) {
    throw new Error("Document not found.");
  }

  const activeRunId = runId ?? document.processingRunId ?? (await startDocumentProcessingRun(documentId)).runId;
  const viewer = await getViewerById(document.userId);

  logDocumentPipeline("info", "process_document_requested", {
    documentId,
    dealId: document.dealId,
    fileName: document.fileName,
    runId: activeRunId
  });

  try {
    return await processDocumentPipeline(viewer, document, activeRunId);
  } catch (error) {
    if (error instanceof DocumentRunSupersededError) {
      return repository.getDealAggregate(viewer.id, document.dealId);
    }

    const message =
      error instanceof Error
        ? error.message
        : "We could not reliably process this document.";

    await failDocumentProcessingRun({
      documentId,
      runId: activeRunId,
      message,
      failedStep: getDocumentPipelineFailedStep(error)
    });
    throw error;
  }
}

export async function listDealsForViewer(viewer: Viewer) {
  return getRepository().listDeals(viewer.id);
}

async function loadRawDealAggregatesForViewer(viewer: Viewer) {
  const repository = getRepository();
  const deals = await repository.listDeals(viewer.id);
  const aggregates: DealAggregate[] = [];

  for (const deal of deals) {
    const aggregate = await repository.getDealAggregate(viewer.id, deal.id);

    if (aggregate) {
      aggregates.push(aggregate);
    }
  }

  return aggregates;
}

export async function listDealAggregatesForViewer(viewer: Viewer) {
  const aggregates = await loadRawDealAggregatesForViewer(viewer);

  return aggregates.map((aggregate) => ({
    ...aggregate,
    conflictResults: buildConflictResults(aggregate, aggregates)
  }));
}

export async function listDocumentsForViewer(viewer: Viewer, dealId: string) {
  return getRepository().listDocuments(viewer.id, dealId);
}

export interface DirectUploadFileRegistration {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
}

export interface RegisteredDirectDocumentUpload {
  documentId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
  bucket: string;
  objectPath: string;
  token: string;
}

export async function registerDirectDocumentUploadsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    files?: DirectUploadFileRegistration[];
    pastedText?: string | null;
    documentKindHint?: DocumentKind | null;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const files = (input.files ?? []).filter((file) => file.fileSizeBytes > 0);
  const pastedText = input.pastedText?.trim() ?? null;

  if (files.length === 0 && !pastedText) {
    throw new Error("Please upload at least one file or paste document text.");
  }

  if (files.length > 0 && !supportsDirectStorageUploads()) {
    return {
      mode: "legacy" as const,
      uploads: [] as RegisteredDirectDocumentUpload[],
      documents: [] as DocumentRecord[],
      pastedDocumentIds: [] as string[]
    };
  }

  const createdDocuments: DocumentRecord[] = [];
  const uploads: RegisteredDirectDocumentUpload[] = [];
  const pastedDocumentIds: string[] = [];

  for (const file of files) {
    const target = await createSignedUploadTarget({
      fileName: file.fileName,
      folder: dealId
    });

    const document = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: file.fileName,
      mimeType: file.mimeType || "application/octet-stream",
      storagePath: target.storagePath,
      fileSizeBytes: file.fileSizeBytes,
      checksumSha256: file.checksumSha256,
      processingStatus: "pending",
      rawText: null,
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "file",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(document);
    uploads.push({
      documentId: document.id,
      fileName: file.fileName,
      mimeType: file.mimeType || "application/octet-stream",
      fileSizeBytes: file.fileSizeBytes,
      checksumSha256: file.checksumSha256,
      bucket: target.bucket,
      objectPath: target.objectPath,
      token: target.token
    });
  }

  if (pastedText) {
    const title = inferPastedTextFileName(pastedText);
    const pastedDocument = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: title,
      mimeType: "text/plain",
      storagePath: `pasted:${title}`,
      fileSizeBytes: Buffer.byteLength(pastedText, "utf8"),
      checksumSha256: null,
      processingStatus: "pending",
      rawText: pastedText,
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "pasted_text",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(pastedDocument);
    pastedDocumentIds.push(pastedDocument.id);
  }

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(dealId);
  }

  return {
    mode: "direct" as const,
    uploads,
    documents: createdDocuments,
    pastedDocumentIds
  };
}

export async function completeDirectDocumentUploadsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    succeededDocumentIds: string[];
    failedUploads: Array<{ documentId: string; errorMessage: string }>;
    startProcessing?: boolean;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const createdDocuments = aggregate.documents.filter((document) =>
    document.userId === viewer.id &&
    [...input.succeededDocumentIds, ...input.failedUploads.map((entry) => entry.documentId)].includes(
      document.id
    )
  );

  for (const failure of input.failedUploads) {
    await getRepository().updateDocument(failure.documentId, {
      processingStatus: "failed",
      errorMessage: failure.errorMessage
    });
  }

  if (input.startProcessing !== false) {
    for (const documentId of input.succeededDocumentIds) {
      const queue = await enqueueDocumentProcessing(documentId);
      if (queue.mode === "local") {
        void processDocumentById(documentId, queue.runId).catch(async () => {
          await getRepository().getDealAggregate(viewer.id, dealId);
        });
      }
    }
  }

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(dealId);
  }

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return {
    documents: createdDocuments,
    succeededCount: input.succeededDocumentIds.length,
    failedCount: input.failedUploads.length
  };
}

export async function getDealForViewer(viewer: Viewer, dealId: string) {
  const target = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!target) {
    return null;
  }
  const normalizedTarget = await hydrateProfileBackedCreatorName(viewer, target);

  const aggregates = await loadRawDealAggregatesForViewer(viewer);
  const comparisonSet = aggregates.some((aggregate) => aggregate.deal.id === dealId)
    ? aggregates
    : [normalizedTarget, ...aggregates];

  return {
    ...normalizedTarget,
    conflictResults: buildConflictResults(normalizedTarget, comparisonSet)
  };
}

export async function createDealForViewer(
  viewer: Viewer,
  input: Pick<DealRecord, "brandName" | "campaignName"> & { notes?: string | null }
) {
  await assertViewerWithinUsageLimit(viewer, "active_workspaces");
  const deal = await getRepository().createDeal(viewer.id, input);

  if (input.notes?.trim()) {
    await getRepository().upsertTerms(
      deal.id,
      mergeTerms(createEmptyTerms(deal), {
        ...createEmptyTerms(deal),
        notes: input.notes.trim()
      })
    );
  }

  void queueAssistantSnapshotRefresh(viewer, deal.id).catch(() => undefined);

  return deal;
}

export async function updateDealForViewer(
  viewer: Viewer,
  dealId: string,
  patch: Partial<DealRecord>
) {
  const deal = await getRepository().updateDeal(viewer.id, dealId, patch);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return deal;
}

export async function deleteDealForViewer(viewer: Viewer, dealId: string) {
  const repository = getRepository();

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const deal = await repository.getDealAggregate(viewer.id, dealId);
      if (deal) {
        const session = await prisma.intakeSession.findUnique({
          where: { dealId },
          select: { id: true }
        });
        const sessionId = session?.id ?? dealId;

        await emitNotificationSeedForUser(viewer.id, {
          category: "workspace",
          eventType: "workspace.deleted",
          entityType: "workspace",
          entityId: sessionId,
          sessionId,
          dealId,
          title: `Workspace deleted: ${deal.deal.brandName || deal.deal.campaignName || "Untitled"}`,
          description: "This workspace was deleted and cannot be recovered.",
          href: "/app",
          dedupeKey: `workspace.deleted:${sessionId}`,
          createdAt: new Date()
        });
      }
    } catch {
      // Notification failure should not block deletion
    }
  }

  return repository.deleteDeal(viewer.id, dealId);
}

export async function updateTermsForViewer(
  viewer: Viewer,
  dealId: string,
  patch: Partial<Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">>
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
  const existing = withPreferredCreatorName(
    aggregate.terms ?? createEmptyTerms(aggregate.deal),
    preferredCreatorName
  );
  const changedFields = detectChangedFields(existing, patch);
  const nextManualEdits = Array.from(new Set([
    ...(aggregate.terms?.manuallyEditedFields ?? []),
    ...changedFields
  ]));

  const nextTerms = mergeTerms(
    existing,
    { ...patch, manuallyEditedFields: nextManualEdits }
  );
  nextTerms.manuallyEditedFields = nextManualEdits;
  const terms = await getRepository().upsertTerms(dealId, nextTerms);
  if (process.env.DATABASE_URL) {
    await syncPaymentRecordForDeal(dealId, nextTerms);
  }

  await getRepository().updateDeal(viewer.id, dealId, {
    nextDeliverableDate: earliestDeliverableDate(nextTerms),
    brandName: nextTerms.brandName ?? aggregate.deal.brandName,
    campaignName: nextTerms.campaignName ?? aggregate.deal.campaignName
  });

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return terms;
}

export async function confirmTermsFieldForViewer(
  viewer: Viewer,
  dealId: string,
  fieldPath: string
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
  const existing = withPreferredCreatorName(
    aggregate.terms ?? createEmptyTerms(aggregate.deal),
    preferredCreatorName
  );
  const nextManualEdits = Array.from(
    new Set([...(existing.manuallyEditedFields ?? []), fieldPath])
  );

  const nextTerms = {
    ...existing,
    manuallyEditedFields: nextManualEdits
  };

  const terms = await getRepository().upsertTerms(dealId, nextTerms);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return terms;
}

export async function updateDealNotesForViewer(
  viewer: Viewer,
  dealId: string,
  notes: string | null
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const nextTerms = mergeTerms(
    withPreferredCreatorName(
      aggregate.terms ?? createEmptyTerms(aggregate.deal),
      await getPreferredCreatorNameForViewer(viewer)
    ),
    { notes }
  );
  const terms = await getRepository().upsertTerms(dealId, nextTerms);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return terms;
}

export async function uploadDocumentsForViewer(
  viewer: Viewer,
  dealId: string,
  input: {
    files?: File[];
    pastedText?: string | null;
    documentKindHint?: DocumentKind | null;
    startProcessing?: boolean;
  }
) {
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const createdDocuments: DocumentRecord[] = [];
  const files = (input.files ?? []).filter((file) => file.size > 0);

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storeUploadedBytes({
      fileName: file.name,
      bytes,
      contentType: file.type || "application/octet-stream",
      folder: dealId
    });
    const document = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      storagePath,
      fileSizeBytes: file.size,
      checksumSha256: null,
      processingStatus: "pending",
      rawText: null,
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "file",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(document);
  }

  if (input.pastedText?.trim()) {
    const title = inferPastedTextFileName(input.pastedText.trim());
    const pastedDocument = await getRepository().createDocument({
      dealId,
      userId: viewer.id,
      fileName: title,
      mimeType: "text/plain",
      storagePath: `pasted:${title}`,
      fileSizeBytes: Buffer.byteLength(input.pastedText.trim(), "utf8"),
      checksumSha256: null,
      processingStatus: "pending",
      rawText: input.pastedText.trim(),
      normalizedText: null,
      documentKind: input.documentKindHint ?? "unknown",
      classificationConfidence: null,
      sourceType: "pasted_text",
      errorMessage: null,
      processingRunId: null,
      processingRunStateJson: null,
      processingStartedAt: null
    });

    createdDocuments.push(pastedDocument);
  }

  if (createdDocuments.length === 0) {
    throw new Error("Please upload at least one file or paste document text.");
  }

  if (input.startProcessing !== false) {
    for (const document of createdDocuments) {
      const queue = await enqueueDocumentProcessing(document.id);

      if (queue.mode === "local") {
        void processDocumentById(document.id, queue.runId).catch(async () => {
          await getRepository().getDealAggregate(viewer.id, dealId);
        });
      }
    }
  }

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(dealId);
  }

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return getRepository().getDealAggregate(viewer.id, dealId);
}

export async function reprocessDocumentForViewer(
  viewer: Viewer,
  documentId: string
) {
  const document = await getRepository().getDocument(documentId);
  if (!document || document.userId !== viewer.id) {
    return null;
  }

  await getRepository().updateDocument(document.id, {
    processingStatus: "pending",
    errorMessage: null
  });
  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(document.dealId);
  }

  const queue = await enqueueDocumentProcessing(document.id);

  if (queue.mode === "local") {
    void processDocumentById(document.id, queue.runId).catch(() => undefined);
  }

  void queueAssistantSnapshotRefresh(viewer, document.dealId).catch(() => undefined);

  return getRepository().getDealAggregate(viewer.id, document.dealId);
}

export async function activateSummaryVariantForViewer(
  viewer: Viewer,
  dealId: string,
  summaryType: SummaryType
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);

  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const latestLegal = getLatestSummaryByType(aggregate.summaries, "legal");
  if (!latestLegal) {
    throw new Error("No legal summary is available for this workspace yet.");
  }

  if (summaryType === "legal") {
    const restored = await repository.restoreSummary(dealId, latestLegal.id);

    if (!restored) {
      throw new Error("Could not restore the legal summary.");
    }

    await repository.updateDeal(viewer.id, dealId, {
      summary: restored.body
    });
    void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
    return restored;
  }

  const latestVariant = getLatestSummaryByType(aggregate.summaries, summaryType);
  if (latestVariant?.parentSummaryId === latestLegal.id) {
    const restored = await repository.restoreSummary(dealId, latestVariant.id);

    if (!restored) {
      throw new Error("Could not restore the saved summary variant.");
    }

    await repository.updateDeal(viewer.id, dealId, {
      summary: restored.body
    });
    void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
    return restored;
  }

  const generated = await buildGeneratedSummaryVariant({
    aggregate,
    baseSummary: latestLegal,
    targetType: summaryType
  });
  const saved = await repository.saveSummary(dealId, latestLegal.documentId, generated);

  await repository.updateDeal(viewer.id, dealId, {
    summary: saved.body
  });
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return saved;
}

export async function restoreSummaryForViewer(
  viewer: Viewer,
  dealId: string,
  summaryId: string
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);

  if (!aggregate) {
    throw new Error("Deal not found.");
  }

  const summary = aggregate.summaries.find((entry) => entry.id === summaryId);
  if (!summary || summary.summaryType === null) {
    throw new Error("Summary version not found.");
  }

  const restored = await repository.restoreSummary(dealId, summaryId);

  if (!restored) {
    throw new Error("Could not restore that summary version.");
  }

  await repository.updateDeal(viewer.id, dealId, {
    summary: restored.body
  });
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return restored;
}

export async function generateDraftForViewer(
  viewer: Viewer,
  dealId: string,
  intent: DraftIntent
) {
  await assertViewerWithinUsageLimit(viewer, "deal_drafts_monthly");
  const aggregate = await getRepository().getDealAggregate(viewer.id, dealId);
  if (!aggregate) {
    return null;
  }

  const profile = process.env.DATABASE_URL
    ? await getProfileForViewer(viewer).catch(() => null)
    : null;
  const senderName =
    profile?.preferredSignature?.trim() ||
    profile?.displayName?.trim() ||
    viewer.displayName;
  const draft = generateEmailDraft(aggregate, intent, senderName);
  const saved = await getRepository().saveEmailDraft(dealId, intent, draft);
  await recordViewerUsage(viewer, "deal_drafts_monthly");
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return saved;
}

export async function ensureDraftsForDeal(
  viewer: Viewer,
  dealId: string,
  intents: DraftIntent[]
) {
  const aggregate = (await getDealForViewer(viewer, dealId)) as DealAggregate | null;
  if (!aggregate) {
    return null;
  }

  for (const intent of intents) {
    if (!aggregate.emailDrafts.some((draft) => draft.intent === intent)) {
      await generateDraftForViewer(viewer, dealId, intent);
    }
  }

  return getDealForViewer(viewer, dealId);
}

export async function applyPendingChangesForViewer(
  viewer: Viewer,
  dealId: string,
  acceptedFields: string[]
) {
  const repository = getRepository();
  const aggregate = await repository.getDealAggregate(viewer.id, dealId);
  if (!aggregate?.terms?.pendingExtraction) {
    return null;
  }

  const pending = aggregate.terms.pendingExtraction as PendingExtractionData;
  const applied = buildAppliedTerms(aggregate.terms, pending, acceptedFields);
  await repository.upsertTerms(dealId, applied);

  if (process.env.DATABASE_URL) {
    await syncPaymentRecordForDeal(dealId, applied);
  }

  await repository.updateDeal(viewer.id, dealId, {
    nextDeliverableDate: earliestDeliverableDate(applied),
    brandName: applied.brandName ?? aggregate.deal.brandName,
    campaignName: applied.campaignName ?? aggregate.deal.campaignName
  });

  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);

  return repository.getDealAggregate(viewer.id, dealId);
}

export async function dismissPendingChangesForViewer(
  viewer: Viewer,
  dealId: string
) {
  const repository = getRepository();
  await repository.savePendingExtraction(dealId, null);
  void queueAssistantSnapshotRefresh(viewer, dealId).catch(() => undefined);
  return repository.getDealAggregate(viewer.id, dealId);
}
