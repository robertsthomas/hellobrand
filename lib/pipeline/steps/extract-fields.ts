/**
 * This file runs the field extraction step for a document.
 * It owns the structured extraction pass, normalized extraction persistence, evidence records, and review items.
 */
import {
  extractBriefData,
  extractStructuredTerms,
  inferBriefBrandName,
  inferBriefCampaignName,
  isBriefLikeDocumentKind,
  parseBriefDeliverables,
  shouldUseInferredBriefBrandName,
} from "@/lib/analysis/fallback";
import {
  extractBriefWithLlm,
  extractSectionWithLlm,
  hasLlmKey,
} from "@/lib/analysis/llm";
import {
  finalizeDocumentExtraction,
  getPreferredCreatorNameForViewer,
  logDocumentPipeline,
  writeExtractionDebugSnapshot,
} from "@/lib/document-pipeline-shared";
import { resolveDocumentRoutingDecision } from "@/lib/document-routing";
import { sanitizeCampaignName } from "@/lib/party-labels";
import { getRepository } from "@/lib/repository";
import {
  buildReviewItems,
  getEvidenceSourceType,
  resolveSectionId,
  saveArtifact,
  saveObservabilityArtifact,
} from "@/lib/pipeline/artifacts";
import { assertCurrentRun, executePipelineStep } from "@/lib/pipeline/run-state";
import type {
  BriefData,
  DocumentKind,
  DocumentSectionInput,
  ExtractionPipelineResult,
} from "@/lib/types";

const SINGLE_PASS_LLM_EXTRACTION_MAX_CHARS = 12_000;

function shouldUseSinglePassLlmExtraction(input: {
  normalizedText: string;
  sectionInputs: DocumentSectionInput[];
}) {
  if (input.sectionInputs.length <= 1) {
    return true;
  }

  return input.normalizedText.length <= SINGLE_PASS_LLM_EXTRACTION_MAX_CHARS;
}

function isGenericCampaignName(value: string | null | undefined) {
  return sanitizeCampaignName(value) === null;
}

function createEmptyBriefData(documentId: string): BriefData {
  return {
    campaignOverview: null,
    messagingPoints: [],
    talkingPoints: [],
    creativeConceptOverview: null,
    brandGuidelines: null,
    approvalRequirements: null,
    targetAudience: null,
    toneAndStyle: null,
    doNotMention: [],
    sourceDocumentIds: [documentId],
  };
}

function applyBriefExtractionHeuristics(input: {
  documentId: string;
  fileName: string;
  normalizedText: string;
  documentKind: DocumentKind;
  extraction: ExtractionPipelineResult;
}) {
  const { documentId, fileName, normalizedText, documentKind } = input;
  const extraction = input.extraction;

  if (!isBriefLikeDocumentKind(documentKind)) {
    return extraction;
  }

  const briefData = extractBriefData(normalizedText, documentKind);
  if (briefData && !extraction.data.briefData) {
    extraction.data.briefData = briefData;
  }

  const inferredBrandName = inferBriefBrandName(normalizedText);
  if (shouldUseInferredBriefBrandName(extraction.data.brandName, inferredBrandName)) {
    extraction.data.brandName = inferredBrandName;
  }

  if (isGenericCampaignName(extraction.data.campaignName)) {
    extraction.data.campaignName =
      inferBriefCampaignName(normalizedText, fileName) ?? extraction.data.campaignName;
  }

  if ((extraction.data.deliverables?.length ?? 0) === 0) {
    extraction.data.deliverables = parseBriefDeliverables(normalizedText, extraction.evidence);
  }

  if (extraction.data.briefData) {
    extraction.data.briefData = {
      ...extraction.data.briefData,
      sourceDocumentIds: Array.from(
        new Set([...(extraction.data.briefData.sourceDocumentIds ?? []), documentId])
      ),
    };
  }

  return extraction;
}

async function applyLlmExtraction(input: {
  documentId: string;
  normalizedText: string;
  documentKind: DocumentKind;
  sectionInputs: DocumentSectionInput[];
  extraction: ExtractionPipelineResult;
}) {
  if (!hasLlmKey()) {
    return input.extraction;
  }

  const fallbackSection = {
    title: "General",
    content: input.normalizedText,
    chunkIndex: 0,
    pageRange: null,
  };
  const llmSections = shouldUseSinglePassLlmExtraction(input)
    ? [fallbackSection]
    : input.sectionInputs.length > 0
      ? input.sectionInputs
      : [fallbackSection];

  let extraction = input.extraction;
  for (const section of llmSections) {
    try {
      extraction = await extractSectionWithLlm(section, input.documentKind, extraction);
    } catch {
      break;
    }
  }

  if (isBriefLikeDocumentKind(input.documentKind)) {
    const fallbackBriefData = extraction.data.briefData ?? createEmptyBriefData(input.documentId);
    const briefData = await extractBriefWithLlm(
      input.normalizedText,
      input.documentKind,
      fallbackBriefData
    ).catch(() => fallbackBriefData);

    extraction = {
      ...extraction,
      data: {
        ...extraction.data,
        briefData: {
          ...briefData,
          sourceDocumentIds: Array.from(
            new Set([...(briefData.sourceDocumentIds ?? []), input.documentId])
          ),
        },
      },
    };
  }

  return extraction;
}

export async function buildStructuredExtractionForDocument(input: {
  documentId: string;
  fileName: string;
  normalizedText: string;
  documentKind: DocumentKind;
  sectionInputs: DocumentSectionInput[];
  preferredCreatorName: string;
}) {
  let extraction: ExtractionPipelineResult = extractStructuredTerms(
    input.normalizedText,
    input.sectionInputs,
    input.documentKind
  );

  extraction = applyBriefExtractionHeuristics({
    documentId: input.documentId,
    fileName: input.fileName,
    normalizedText: input.normalizedText,
    documentKind: input.documentKind,
    extraction,
  });

  extraction = await applyLlmExtraction({
    documentId: input.documentId,
    normalizedText: input.normalizedText,
    documentKind: input.documentKind,
    sectionInputs: input.sectionInputs,
    extraction,
  });

  extraction = applyBriefExtractionHeuristics({
    documentId: input.documentId,
    fileName: input.fileName,
    normalizedText: input.normalizedText,
    documentKind: input.documentKind,
    extraction,
  });

  return finalizeDocumentExtraction(
    input.normalizedText,
    extraction,
    input.preferredCreatorName
  );
}

export async function runExtractFieldsStep(documentId: string, runId: string) {
  return executePipelineStep(
    { documentId, runId, step: "extract_fields" },
    async ({ document, viewer }) => {
      if (!document.normalizedText) {
        throw new Error("Normalized document text not found.");
      }

      const repository = getRepository();
      const sections = await repository.listDocumentSections(document.id);
      const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
      const routing = resolveDocumentRoutingDecision({ document });
      const sectionInputs: DocumentSectionInput[] = sections.map((section) => ({
        title: section.title,
        content: section.content,
        chunkIndex: section.chunkIndex,
        pageRange: section.pageRange,
      }));

      logDocumentPipeline("info", "document_routed", {
        dealId: document.dealId,
        documentId: document.id,
        fileName: document.fileName,
        documentKind: document.documentKind,
        confidence: document.classificationConfidence,
        extractionRoute: routing.extractionRoute,
        processor: routing.processor,
        reasons: routing.reasons,
        runId,
      });

      const sanitizedExtraction: ExtractionPipelineResult =
        await buildStructuredExtractionForDocument({
          documentId: document.id,
          fileName: document.fileName,
          normalizedText: document.normalizedText,
          documentKind: document.documentKind,
          sectionInputs,
          preferredCreatorName,
        });
      const extractionEvidence = Array.isArray(sanitizedExtraction.evidence)
        ? sanitizedExtraction.evidence
        : [];

      logDocumentPipeline("info", "field_extraction_complete", {
        dealId: document.dealId,
        documentId: document.id,
        fileName: document.fileName,
        sectionCount: sections.length,
        extractionCount: 1,
        usedLlm: sanitizedExtraction.model.startsWith("llm:"),
        extractionRoute: routing.extractionRoute,
        processor: sanitizedExtraction.model,
        runId,
      });

      logDocumentPipeline("info", "merge_complete", {
        dealId: document.dealId,
        documentId: document.id,
        evidenceCount: extractionEvidence.length,
        deliverablesCount: sanitizedExtraction.data.deliverables?.length ?? 0,
        hasPaymentAmount: sanitizedExtraction.data.paymentAmount !== null,
        hasBrandName: Boolean(sanitizedExtraction.data.brandName),
        hasCampaignName: Boolean(sanitizedExtraction.data.campaignName),
        runId,
      });

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
          confidence: entry.confidence,
        }))
      );

      const normalizedArtifact = await saveArtifact({
        documentId: document.id,
        runId,
        step: "extract_fields",
        kind: "normalized_extraction",
        processor: sanitizedExtraction.model,
        payload: sanitizedExtraction,
      });

      await repository.replaceDocumentFieldEvidence(
        document.id,
        runId,
        extractionEvidence.map((entry) => ({
          fieldPath: entry.fieldPath,
          snippet: entry.snippet,
          sourceType: getEvidenceSourceType(entry),
          sectionId: resolveSectionId(sections, entry.sectionKey),
          artifactId: normalizedArtifact.id,
          confidence: entry.confidence,
        }))
      );

      const reviewItems = buildReviewItems({
        extraction: sanitizedExtraction,
        sections,
        artifactId: normalizedArtifact.id,
      });

      await repository.replaceDocumentReviewItems(document.id, runId, reviewItems);

      const debugSnapshotPath = writeExtractionDebugSnapshot({
        runId,
        document,
        routing,
        sections,
        sectionInputs,
        extraction: sanitizedExtraction,
        extractionEvidence,
        reviewItems,
        normalizedArtifactId: normalizedArtifact.id,
      });
      if (debugSnapshotPath) {
        logDocumentPipeline("info", "extraction_debug_snapshot_written", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          path: debugSnapshotPath,
          runId,
        });
      }

      await saveObservabilityArtifact({
        documentId: document.id,
        runId,
        step: "extract_fields",
        processor: sanitizedExtraction.model,
        payload: {
          event: "extract_fields_metrics",
          extractionRoute: routing.extractionRoute,
          processor: sanitizedExtraction.model,
          usedFallback: !sanitizedExtraction.model.startsWith("llm:"),
          pageCount: null,
          entityCount: null,
          evidenceCount: extractionEvidence.length,
          conflictCount: sanitizedExtraction.conflicts.length,
          reviewItemCount: reviewItems.length,
          confidence: sanitizedExtraction.confidence,
          estimatedCostUsd: 0,
        },
      });

      return sanitizedExtraction;
    }
  );
}
