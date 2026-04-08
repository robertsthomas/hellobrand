import {
  analyzeCreatorRisks,
  buildCreatorSummary,
  classifyDocumentHeuristically,
  extractBriefData,
  extractStructuredTerms,
  mergeExtractionResults,
  splitIntoSections
} from "@/lib/analysis/fallback";
import {
  analyzeRisksWithLlm,
  extractBriefWithLlm,
  extractSectionWithLlm,
  generateSummaryWithLlm,
  getLlmRoute,
  hasLlmKey
} from "@/lib/analysis/llm";
import { getViewerById } from "@/lib/auth";
import {
  createDocumentProcessingRunState,
  createEmptyTerms,
  DOCUMENT_PIPELINE_STEPS,
  earliestDeliverableDate,
  finalizeDocumentExtraction,
  getDocumentProcessingRunState,
  getPreferredCreatorNameForViewer,
  isDocumentPipelineStepComplete,
  logDocumentPipeline,
  markDocumentPipelineRunFailed,
  markDocumentPipelineStepComplete,
  mergeTerms,
  reconstructExtractionPipelineResult,
  withPreferredCreatorName,
  writeGenerationSnapshot
} from "@/lib/document-pipeline-shared";
import { extractDocumentText, normalizeDocumentText } from "@/lib/documents/extract";
import { syncIntakeSessionForDealId } from "@/lib/intake-state";
import { syncPaymentRecordForDeal } from "@/lib/payments";
import { coalesceExtractions, hasMeaningfulChanges } from "@/lib/pending-changes";
import { enrichBrandCategoryWithPeopleDataLabs } from "@/lib/people-data-labs";
import { getRepository } from "@/lib/repository";
import { readStoredBytes } from "@/lib/storage";
import type {
  DealAggregate,
  DocumentKind,
  DocumentRecord,
  DocumentSectionRecord,
  ExtractionPipelineResult,
  JobType,
  PendingExtractionData,
  Viewer
} from "@/lib/types";

export class DocumentRunSupersededError extends Error {
  constructor(documentId: string, runId: string) {
    super(`Document processing run superseded for document ${documentId} (${runId}).`);
    this.name = "DocumentRunSupersededError";
  }
}

function llmSectionLimits() {
  const model = getLlmRoute("extract_section").primary.toLowerCase();
  const usingFreeModel =
    model.includes("openrouter/free") || model.includes(":free") || model.includes("/free");

  return usingFreeModel
    ? { maxSections: 6, concurrency: 2, usingFreeModel: true }
    : { maxSections: 14, concurrency: 6, usingFreeModel: false };
}

function scoreSectionForLlm(
  section: { title: string; content: string; chunkIndex: number },
  documentKind: DocumentKind
) {
  const title = section.title.toLowerCase();
  const content = section.content.toLowerCase();
  let score = Math.min(section.content.length, 4000) / 100;

  if (title === "general") {
    score -= 15;
  }

  if (section.content.length < 80) {
    score -= 12;
  }

  const keywordGroups: Record<DocumentKind | "shared", string[]> = {
    shared: [
      "payment",
      "compensation",
      "rate",
      "fee",
      "deliverable",
      "usage",
      "rights",
      "whitelist",
      "exclusiv",
      "revision",
      "termination",
      "campaign",
      "brand"
    ],
    contract: ["agreement", "term", "services", "scope", "content", "payment terms"],
    deliverables_brief: ["deliverables", "timeline", "post", "story", "reel", "tiktok"],
    campaign_brief: ["brief", "messaging", "concept", "brand guidelines"],
    pitch_deck: ["overview", "campaign", "deliverables", "brand"],
    invoice: ["invoice", "amount", "total", "net", "payment", "client"],
    email_thread: ["subject:", "from:", "usage", "rate", "deadline", "follow up"],
    unknown: ["agreement", "campaign", "deliverables", "payment"]
  };

  for (const keyword of keywordGroups.shared) {
    if (title.includes(keyword) || content.includes(keyword)) {
      score += 8;
    }
  }

  for (const keyword of keywordGroups[documentKind]) {
    if (title.includes(keyword) || content.includes(keyword)) {
      score += 10;
    }
  }

  return score;
}

function selectSectionsForLlm(
  sections: Array<{ title: string; content: string; chunkIndex: number }>,
  documentKind: DocumentKind
) {
  const limits = llmSectionLimits();
  const selected = [...sections]
    .map((section) => ({
      section,
      score: scoreSectionForLlm(section, documentKind)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limits.maxSections)
    .sort((left, right) => left.section.chunkIndex - right.section.chunkIndex)
    .map((entry) => entry.section);

  return {
    ...limits,
    selected
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  values: TInput[],
  concurrency: number,
  worker: (value: TInput, index: number) => Promise<TOutput>
) {
  const results = new Array<TOutput>(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, () =>
      runWorker()
    )
  );

  return results;
}

function isSupersededError(error: unknown): error is DocumentRunSupersededError {
  return error instanceof DocumentRunSupersededError;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Document processing failed.";
}

async function queueAssistantSnapshotRefresh(viewer: Viewer, dealId?: string | null) {
  const { refreshAssistantSnapshotsForViewer } = await import("@/lib/assistant/snapshots");
  await refreshAssistantSnapshotsForViewer(viewer, { dealId });
}

async function loadDocumentForRun(documentId: string, runId: string) {
  const document = await getRepository().getDocument(documentId);

  if (!document) {
    throw new Error("Document not found.");
  }

  if (document.processingRunId !== runId) {
    throw new DocumentRunSupersededError(documentId, runId);
  }

  return document;
}

async function assertCurrentRun(documentId: string, runId: string) {
  return loadDocumentForRun(documentId, runId);
}

async function updateCurrentRunState(
  documentId: string,
  runId: string,
  updater: (state: NonNullable<ReturnType<typeof getDocumentProcessingRunState>>) => NonNullable<ReturnType<typeof getDocumentProcessingRunState>>
) {
  const document = await loadDocumentForRun(documentId, runId);
  const state = getDocumentProcessingRunState(document) ?? createDocumentProcessingRunState(runId);
  return getRepository().updateDocument(documentId, {
    processingRunStateJson: updater(state)
  });
}

async function markStepComplete(documentId: string, runId: string, step: JobType) {
  await updateCurrentRunState(documentId, runId, (state) =>
    markDocumentPipelineStepComplete(state, step)
  );
}

export async function failDocumentProcessingRun(input: {
  documentId: string;
  runId: string;
  message: string;
  failedStep?: JobType | null;
}) {
  const document = await getRepository().getDocument(input.documentId);

  if (!document || document.processingRunId !== input.runId) {
    return null;
  }

  const state =
    getDocumentProcessingRunState(document) ?? createDocumentProcessingRunState(input.runId);

  const updated = await getRepository().updateDocument(input.documentId, {
    processingStatus: "failed",
    errorMessage: input.message,
    processingRunStateJson: markDocumentPipelineRunFailed(state, {
      step: input.failedStep ?? null,
      message: input.message
    })
  });

  if (process.env.DATABASE_URL) {
    await syncIntakeSessionForDealId(document.dealId);
  }

  logDocumentPipeline("error", "pipeline_failed", {
    dealId: document.dealId,
    documentId: document.id,
    fileName: document.fileName,
    runId: input.runId,
    error: input.message
  });

  return updated;
}

function parseFailedStep(error: unknown): JobType | null {
  const message = getErrorMessage(error);

  for (const step of DOCUMENT_PIPELINE_STEPS) {
    if (message.startsWith(`${step}:`)) {
      return step;
    }
  }

  return null;
}

async function executePipelineStep<T>(
  input: {
    documentId: string;
    runId: string;
    step: JobType;
  },
  work: (context: { document: DocumentRecord; viewer: Viewer }) => Promise<T>
) {
  const repository = getRepository();
  const document = await loadDocumentForRun(input.documentId, input.runId);

  if (isDocumentPipelineStepComplete(document, input.runId, input.step)) {
    return {
      skipped: true as const,
      document,
      viewer: await getViewerById(document.userId),
      result: null as T | null
    };
  }

  const viewer = await getViewerById(document.userId);
  const job = await repository.createJob({
    dealId: document.dealId,
    documentId: document.id,
    type: input.step,
    status: "processing",
    attemptCount: 1,
    failureReason: null
  });
  const startedAt = Date.now();

  logDocumentPipeline("info", "stage_start", {
    dealId: document.dealId,
    documentId: document.id,
    stage: input.step,
    jobId: job.id,
    runId: input.runId
  });

  try {
    const result = await work({ document, viewer });
    await markStepComplete(document.id, input.runId, input.step);
    await repository.updateJob(job.id, {
      status: "ready",
      failureReason: null
    });
    logDocumentPipeline("info", "stage_complete", {
      dealId: document.dealId,
      documentId: document.id,
      stage: input.step,
      jobId: job.id,
      runId: input.runId,
      durationMs: Date.now() - startedAt
    });

    return {
      skipped: false as const,
      document: await loadDocumentForRun(document.id, input.runId),
      viewer,
      result
    };
  } catch (error) {
    const message = getErrorMessage(error);
    await repository.updateJob(job.id, {
      status: "failed",
      failureReason: message
    });
    logDocumentPipeline("error", "stage_failed", {
      dealId: document.dealId,
      documentId: document.id,
      stage: input.step,
      jobId: job.id,
      runId: input.runId,
      durationMs: Date.now() - startedAt,
      error: message
    });

    if (isSupersededError(error)) {
      throw error;
    }

    throw new Error(`${input.step}: ${message}`);
  }
}

async function loadExtractionFromRecords(document: DocumentRecord) {
  const repository = getRepository();
  const [result, evidence, sections] = await Promise.all([
    repository.getExtractionResult(document.id),
    repository.listExtractionEvidence(document.id),
    repository.listDocumentSections(document.id)
  ]);

  if (!result) {
    throw new Error("Extraction result not found for document.");
  }

  return reconstructExtractionPipelineResult({
    result,
    evidence,
    sections
  });
}

export async function runExtractTextStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "extract_text" }, async ({ document }) => {
    logDocumentPipeline("info", "pipeline_start", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      sourceType: document.sourceType,
      mimeType: document.mimeType,
      runId
    });

    await getRepository().updateDocument(document.id, {
      processingStatus: "processing",
      errorMessage: null
    });

    const extractionSource =
      document.sourceType === "pasted_text"
        ? {
            rawText: document.rawText ?? "",
            normalizedText: normalizeDocumentText(document.rawText ?? "")
          }
        : await extractDocumentText(
            await readStoredBytes(document.storagePath),
            document.mimeType,
            document.fileName
          );

    await assertCurrentRun(document.id, runId);

    await getRepository().updateDocument(document.id, {
      processingStatus: "processing",
      rawText: extractionSource.rawText,
      normalizedText: extractionSource.normalizedText,
      errorMessage: null
    });

    return extractionSource;
  });
}

export async function runClassifyDocumentStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "classify_document" }, async ({ document }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const classification = classifyDocumentHeuristically(
      document.normalizedText,
      document.fileName
    );

    await assertCurrentRun(document.id, runId);
    await getRepository().updateDocument(document.id, {
      documentKind: classification.documentKind,
      classificationConfidence: classification.confidence
    });

    return classification;
  });
}

export async function runSectionDocumentStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "section_document" }, async ({ document }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const sections = splitIntoSections(document.normalizedText, document.documentKind);

    logDocumentPipeline("info", "sections_created", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      documentKind: document.documentKind,
      sectionCount: sections.length,
      normalizedChars: document.normalizedText.length,
      runId
    });

    await assertCurrentRun(document.id, runId);
    await getRepository().replaceDocumentSections(document.id, sections);

    return sections;
  });
}

export async function runExtractFieldsStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "extract_fields" }, async ({ document, viewer }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const repository = getRepository();
    const sections = await repository.listDocumentSections(document.id);
    const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
    const llmPlan = selectSectionsForLlm(sections, document.documentKind);
    const llmSectionIds = new Set(llmPlan.selected.map((section) => section.chunkIndex));

    logDocumentPipeline("info", "llm_section_plan", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      model: hasLlmKey() ? getLlmRoute("extract_section").primary : null,
      fallbacks: hasLlmKey() ? getLlmRoute("extract_section").fallbacks : [],
      usingFreeModel: llmPlan.usingFreeModel,
      selectedSectionCount: llmPlan.selected.length,
      totalSectionCount: sections.length,
      concurrency: llmPlan.concurrency,
      selectedSections: llmPlan.selected.map((section) => ({
        chunkIndex: section.chunkIndex,
        title: section.title,
        chars: section.content.length
      })),
      runId
    });

    const partialExtractions = await mapWithConcurrency(
      sections,
      llmPlan.concurrency,
      async (section) => {
        const fallback = extractStructuredTerms(
          section.content,
          [section],
          document.documentKind
        );

        if (!hasLlmKey() || !llmSectionIds.has(section.chunkIndex)) {
          return fallback;
        }

        try {
          return await extractSectionWithLlm(section, document.documentKind, fallback);
        } catch {
          return fallback;
        }
      }
    );

    logDocumentPipeline("info", "field_extraction_complete", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      sectionCount: sections.length,
      extractionCount: partialExtractions.length,
      usedLlm: hasLlmKey(),
      extractionRoute: "legacy",
      runId
    });

    const extraction = mergeExtractionResults(partialExtractions as ExtractionPipelineResult[]);
    const sanitizedExtraction = finalizeDocumentExtraction(
      document.normalizedText,
      extraction,
      preferredCreatorName
    );
    const extractionEvidence = Array.isArray(sanitizedExtraction.evidence)
      ? sanitizedExtraction.evidence
      : [];
    const extractionDeliverables = Array.isArray(sanitizedExtraction.data.deliverables)
      ? sanitizedExtraction.data.deliverables
      : [];

    logDocumentPipeline("info", "merge_complete", {
      dealId: document.dealId,
      documentId: document.id,
      evidenceCount: extractionEvidence.length,
      deliverablesCount: extractionDeliverables.length,
      hasPaymentAmount: sanitizedExtraction.data.paymentAmount !== null,
      hasBrandName: Boolean(sanitizedExtraction.data.brandName),
      hasCampaignName: Boolean(sanitizedExtraction.data.campaignName),
      runId
    });

    if (
      document.documentKind === "campaign_brief" ||
      document.documentKind === "deliverables_brief" ||
      document.documentKind === "pitch_deck"
    ) {
      const fallbackBrief = extractBriefData(document.normalizedText, document.documentKind);
      if (fallbackBrief) {
        fallbackBrief.sourceDocumentIds = [document.id];
        let briefData = fallbackBrief;

        if (hasLlmKey()) {
          try {
            briefData = await extractBriefWithLlm(
              document.normalizedText,
              document.documentKind,
              fallbackBrief
            );
          } catch {
            // Keep fallback brief data.
          }
        }

        sanitizedExtraction.data.briefData = briefData;
      }
    }

    const categoryEnrichment = await enrichBrandCategoryWithPeopleDataLabs(
      sanitizedExtraction.data.brandName
    );

    if (categoryEnrichment?.category) {
      const previousCategory = sanitizedExtraction.data.brandCategory;
      sanitizedExtraction.data.brandCategory = categoryEnrichment.category;
      sanitizedExtraction.evidence = [
        ...sanitizedExtraction.evidence,
        {
          fieldPath: "brandCategory",
          snippet:
            categoryEnrichment.snippet ??
            `${categoryEnrichment.brandName} matched ${categoryEnrichment.category}.`,
          sectionKey: null,
          confidence: categoryEnrichment.confidence
        }
      ];

      if (previousCategory && previousCategory !== categoryEnrichment.category) {
        sanitizedExtraction.evidence.push({
          fieldPath: "brandCategory",
          snippet: `${categoryEnrichment.brandName} company enrichment overrides a conflicting detected category.`,
          sectionKey: null,
          confidence: categoryEnrichment.confidence
        });
      }

      logDocumentPipeline("info", "brand_category_enriched", {
        dealId: document.dealId,
        documentId: document.id,
        brandName: categoryEnrichment.brandName,
        previousCategory,
        enrichedCategory: categoryEnrichment.category,
        confidence: categoryEnrichment.confidence,
        website: categoryEnrichment.website,
        runId
      });
    }

    await assertCurrentRun(document.id, runId);
    await repository.upsertExtractionResult(document.id, sanitizedExtraction);
    await repository.replaceExtractionEvidence(
      document.id,
      extractionEvidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        sectionId:
          sections.find((section) => `section:${section.chunkIndex}` === entry.sectionKey)?.id ??
          null,
        confidence: entry.confidence
      }))
    );

    return sanitizedExtraction;
  });
}

export async function runMergeResultsStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "merge_results" }, async ({ document, viewer }) => {
    const repository = getRepository();
    const extraction = await loadExtractionFromRecords(document);
    const latestAggregate = await repository.getDealAggregate(viewer.id, document.dealId);

    if (!latestAggregate) {
      throw new Error("Deal not found.");
    }

    const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
    const isFirstDocument = latestAggregate.terms === null;
    const existingTerms = latestAggregate.terms ?? createEmptyTerms(latestAggregate.deal);
    const isIntakeDocument =
      latestAggregate.deal.confirmedAt &&
      document.createdAt <= latestAggregate.deal.confirmedAt;
    const shouldMergeDirectly = isFirstDocument || isIntakeDocument;

    if (shouldMergeDirectly) {
      const nextTerms = mergeTerms(
        withPreferredCreatorName(existingTerms, preferredCreatorName),
        extraction.data,
        {
          manuallyEditedFields: latestAggregate.terms?.manuallyEditedFields ?? []
        }
      );
      await repository.upsertTerms(document.dealId, nextTerms);
      if (process.env.DATABASE_URL) {
        await syncPaymentRecordForDeal(document.dealId, nextTerms);
      }

      await repository.updateDeal(viewer.id, document.dealId, {
        analyzedAt: new Date().toISOString(),
        nextDeliverableDate: earliestDeliverableDate(nextTerms),
        brandName: nextTerms.brandName ?? latestAggregate.deal.brandName,
        campaignName: nextTerms.campaignName ?? latestAggregate.deal.campaignName
      });
    } else {
      const mergedFull = mergeTerms(
        createEmptyTerms(latestAggregate.deal),
        extraction.data
      );
      const { pendingExtraction: _pendingExtraction, ...mergedExtraction } = mergedFull;
      const pendingCandidate = mergedExtraction as PendingExtractionData;

      if (!hasMeaningfulChanges(latestAggregate.terms!, pendingCandidate)) {
        const nextTerms = mergeTerms(
          withPreferredCreatorName(existingTerms, preferredCreatorName),
          extraction.data,
          {
            manuallyEditedFields: latestAggregate.terms?.manuallyEditedFields ?? []
          }
        );
        await repository.upsertTerms(document.dealId, nextTerms);
        if (process.env.DATABASE_URL) {
          await syncPaymentRecordForDeal(document.dealId, nextTerms);
        }

        await repository.updateDeal(viewer.id, document.dealId, {
          analyzedAt: new Date().toISOString(),
          nextDeliverableDate: earliestDeliverableDate(existingTerms),
          brandName: existingTerms.brandName ?? latestAggregate.deal.brandName,
          campaignName: existingTerms.campaignName ?? latestAggregate.deal.campaignName
        });
      } else {
        const existingPending = latestAggregate.terms?.pendingExtraction as PendingExtractionData | null;

        const pendingData = existingPending
          ? coalesceExtractions(existingPending, extraction.data, (base, patch) => {
              const full = { ...base, pendingExtraction: null };
              const merged = mergeTerms(full, patch);
              const { pendingExtraction: _pending, ...rest } = merged;
              return rest as PendingExtractionData;
            })
          : pendingCandidate;

        await repository.savePendingExtraction(document.dealId, pendingData);
        await repository.updateDeal(viewer.id, document.dealId, {
          analyzedAt: new Date().toISOString()
        });
      }
    }

    await assertCurrentRun(document.id, runId);
    return extraction;
  });
}

export async function runAnalyzeRisksStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "analyze_risks" }, async ({ document }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const extraction = await loadExtractionFromRecords(document);
    const fallbackRisks = analyzeCreatorRisks(
      document.normalizedText,
      document.id,
      extraction as ReturnType<typeof extractStructuredTerms>
    );
    const risks = !hasLlmKey()
      ? fallbackRisks
      : await analyzeRisksWithLlm(
          document.normalizedText,
          document.documentKind,
          extraction,
          fallbackRisks,
          document.id
        ).catch(() => fallbackRisks);

    await assertCurrentRun(document.id, runId);
    await getRepository().replaceRiskFlagsForDocument(document.dealId, document.id, risks);

    return risks;
  });
}

export async function runGenerateSummaryStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "generate_summary" }, async ({ document, viewer }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const repository = getRepository();
    const extraction = await loadExtractionFromRecords(document);
    const risks = await repository.listRiskFlagsForDocument(document.dealId, document.id);
    const fallbackSummary = buildCreatorSummary(
      extraction as ReturnType<typeof extractStructuredTerms>,
      risks
    );
    const summary = !hasLlmKey()
      ? fallbackSummary
      : await generateSummaryWithLlm(extraction, risks, fallbackSummary).catch(
          () => fallbackSummary
        );

    await assertCurrentRun(document.id, runId);
    await repository.saveSummary(document.dealId, document.id, summary);
    await repository.updateDeal(viewer.id, document.dealId, {
      summary: summary.body,
      analyzedAt: new Date().toISOString()
    });
    await repository.updateDocument(document.id, {
      processingStatus: "ready",
      errorMessage: null
    });

    if (process.env.DATABASE_URL) {
      await syncIntakeSessionForDealId(document.dealId);
    }

    const totalDurationMs = document.processingStartedAt
      ? Date.now() - new Date(document.processingStartedAt).getTime()
      : 0;

    logDocumentPipeline("info", "pipeline_complete", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      durationMs: totalDurationMs,
      riskCount: risks.length,
      summaryLength: summary.body.length,
      deliverablesCount: extraction.data.deliverables?.length ?? 0,
      runId
    });

    try {
      writeGenerationSnapshot({
        dealId: document.dealId,
        documentId: document.id,
        fileName: document.fileName,
        documentKind: document.documentKind,
        model: extraction.model,
        durationMs: totalDurationMs,
        extraction,
        risks,
        summary
      });
    } catch {
      // Snapshot write failure should not affect pipeline completion.
    }

    void queueAssistantSnapshotRefresh(viewer, document.dealId).catch(() => undefined);

    return repository.getDealAggregate(viewer.id, document.dealId);
  });
}

export async function runDocumentPipelineSteps(documentId: string, runId: string) {
  await runExtractTextStep(documentId, runId);
  await runClassifyDocumentStep(documentId, runId);
  await runSectionDocumentStep(documentId, runId);
  await runExtractFieldsStep(documentId, runId);
  await runMergeResultsStep(documentId, runId);
  await runAnalyzeRisksStep(documentId, runId);
  const finalStep = await runGenerateSummaryStep(documentId, runId);

  if (!finalStep.result) {
    throw new Error("generate_summary: Expected final aggregate.");
  }

  return finalStep.result as DealAggregate;
}

export function getDocumentPipelineFailedStep(error: unknown) {
  return parseFailedStep(error);
}
