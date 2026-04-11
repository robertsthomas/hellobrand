/**
 * This file runs the field extraction step for a document.
 * It owns the route-specific extractor call, normalized extraction persistence, evidence records, and review items.
 */
import { getPreferredCreatorNameForViewer, finalizeDocumentExtraction, logDocumentPipeline } from "@/lib/document-pipeline-shared";
import {
  extractBriefTermsWithDocumentAiDetailed,
  hasMeaningfulBriefExtraction
} from "@/lib/document-ai-brief";
import {
  extractContractTermsWithDocumentAiDetailed,
  hasMeaningfulContractExtraction
} from "@/lib/document-ai-contract";
import {
  extractInvoiceTermsWithDocumentAiDetailed,
  hasMeaningfulInvoiceExtraction
} from "@/lib/document-ai-invoice";
import { resolveDocumentRoutingDecision } from "@/lib/document-routing";
import { estimateDocumentAiCostUsd } from "@/lib/document-pipeline-rollout";
import { getRepository } from "@/lib/repository";
import { readStoredBytes } from "@/lib/storage";
import {
  buildReviewItems,
  getEvidenceSourceType,
  resolveSectionId,
  saveArtifact,
  saveObservabilityArtifact
} from "@/lib/pipeline/artifacts";
import {
  assertCurrentRun,
  executePipelineStep,
  getErrorMessage
} from "@/lib/pipeline/run-state";
import type { ExtractionPipelineResult } from "@/lib/types";

export async function runExtractFieldsStep(documentId: string, runId: string) {
  return executePipelineStep({ documentId, runId, step: "extract_fields" }, async ({ document, viewer }) => {
    if (!document.normalizedText) {
      throw new Error("Normalized document text not found.");
    }

    const repository = getRepository();
    const sections = await repository.listDocumentSections(document.id);
    const preferredCreatorName = await getPreferredCreatorNameForViewer(viewer);
    const routing = resolveDocumentRoutingDecision({ document });
    let sanitizedExtraction: ExtractionPipelineResult;
    let rawVendorArtifactId: string | null = null;
    let routeProcessor: string | null = null;
    let pageCount: number | null = null;
    let entityCount: number | null = null;

    logDocumentPipeline("info", "document_routed", {
      dealId: document.dealId,
      documentId: document.id,
      fileName: document.fileName,
      documentKind: document.documentKind,
      confidence: document.classificationConfidence,
      extractionRoute: routing.extractionRoute,
      processor: routing.processor,
      reasons: routing.reasons,
      runId
    });

    if (routing.extractionRoute === "document_ai_brief") {
      let briefExtraction: ExtractionPipelineResult | null = null;

      try {
        const detailedBriefExtraction = await extractBriefTermsWithDocumentAiDetailed({
          bytes: await readStoredBytes(document.storagePath),
          mimeType: document.mimeType,
          deal: {
            brandName: null,
            campaignName: null
          }
        });
        briefExtraction = detailedBriefExtraction.extraction;
        const rawVendorArtifact = await saveArtifact({
          documentId: document.id,
          runId,
          step: "extract_fields",
          kind: "raw_vendor_output",
          processor: detailedBriefExtraction.processor,
          payload: detailedBriefExtraction.rawResponse
        });
        rawVendorArtifactId = rawVendorArtifact.id;
        routeProcessor = detailedBriefExtraction.processor;
        pageCount = detailedBriefExtraction.pageCount;
        entityCount = detailedBriefExtraction.entityCount;
      } catch (error) {
        logDocumentPipeline("error", "document_ai_brief_failed", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          error: getErrorMessage(error),
          runId
        });
        throw error;
      }

      if (briefExtraction && hasMeaningfulBriefExtraction(briefExtraction)) {
        briefExtraction.data.briefData = briefExtraction.data.briefData
          ? {
              ...briefExtraction.data.briefData,
              sourceDocumentIds: [document.id]
            }
          : null;

        sanitizedExtraction = finalizeDocumentExtraction(
          document.normalizedText,
          briefExtraction,
          preferredCreatorName
        );

        logDocumentPipeline("info", "field_extraction_complete", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          sectionCount: sections.length,
          extractionCount: 1,
          usedLlm: false,
          extractionRoute: routing.extractionRoute,
          processor: routing.processor,
          runId
        });
      } else {
        const reason = briefExtraction ? "empty_brief_extraction" : "brief_processor_failed";
        logDocumentPipeline("error", "document_ai_brief_rejected", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          extractionRoute: routing.extractionRoute,
          reason,
          runId
        });
        throw new Error(`Document AI brief extraction failed: ${reason}.`);
      }
    } else if (routing.extractionRoute === "document_ai_contract") {
      let contractExtraction: ExtractionPipelineResult | null = null;

      try {
        const detailedContractExtraction = await extractContractTermsWithDocumentAiDetailed({
          bytes: await readStoredBytes(document.storagePath),
          mimeType: document.mimeType,
          deal: {
            brandName: null,
            campaignName: null
          }
        });
        contractExtraction = detailedContractExtraction.extraction;
        const rawVendorArtifact = await saveArtifact({
          documentId: document.id,
          runId,
          step: "extract_fields",
          kind: "raw_vendor_output",
          processor: detailedContractExtraction.processor,
          payload: detailedContractExtraction.rawResponse
        });
        rawVendorArtifactId = rawVendorArtifact.id;
        routeProcessor = detailedContractExtraction.processor;
        pageCount = detailedContractExtraction.pageCount;
        entityCount = detailedContractExtraction.entityCount;
      } catch (error) {
        logDocumentPipeline("error", "document_ai_contract_failed", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          error: getErrorMessage(error),
          runId
        });
        throw error;
      }

      if (contractExtraction && hasMeaningfulContractExtraction(contractExtraction)) {
        sanitizedExtraction = finalizeDocumentExtraction(
          document.normalizedText,
          contractExtraction,
          preferredCreatorName
        );

        logDocumentPipeline("info", "field_extraction_complete", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          sectionCount: sections.length,
          extractionCount: 1,
          usedLlm: false,
          extractionRoute: routing.extractionRoute,
          processor: routing.processor,
          runId
        });
      } else {
        const reason = contractExtraction
          ? "empty_contract_extraction"
          : "contract_processor_failed";
        logDocumentPipeline("error", "document_ai_contract_rejected", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          extractionRoute: routing.extractionRoute,
          reason,
          runId
        });
        throw new Error(`Document AI contract extraction failed: ${reason}.`);
      }
    } else if (routing.extractionRoute === "document_ai_invoice") {
      let invoiceExtraction: ExtractionPipelineResult | null = null;

      try {
        const detailedInvoiceExtraction = await extractInvoiceTermsWithDocumentAiDetailed({
          bytes: await readStoredBytes(document.storagePath),
          mimeType: document.mimeType,
          deal: {
            brandName: null,
            campaignName: null
          }
        });
        invoiceExtraction = detailedInvoiceExtraction.extraction;
        const rawVendorArtifact = await saveArtifact({
          documentId: document.id,
          runId,
          step: "extract_fields",
          kind: "raw_vendor_output",
          processor: detailedInvoiceExtraction.processor,
          payload: detailedInvoiceExtraction.rawResponse
        });
        rawVendorArtifactId = rawVendorArtifact.id;
        routeProcessor = detailedInvoiceExtraction.processor;
        pageCount = detailedInvoiceExtraction.pageCount;
        entityCount = detailedInvoiceExtraction.entityCount;
      } catch (error) {
        logDocumentPipeline("error", "document_ai_invoice_failed", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          error: getErrorMessage(error),
          runId
        });
        throw error;
      }

      if (invoiceExtraction && hasMeaningfulInvoiceExtraction(invoiceExtraction)) {
        sanitizedExtraction = finalizeDocumentExtraction(
          document.normalizedText,
          invoiceExtraction,
          preferredCreatorName
        );

        logDocumentPipeline("info", "field_extraction_complete", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          sectionCount: sections.length,
          extractionCount: 1,
          usedLlm: false,
          extractionRoute: routing.extractionRoute,
          processor: routing.processor,
          runId
        });
      } else {
        const reason = invoiceExtraction ? "empty_invoice_extraction" : "invoice_processor_failed";
        logDocumentPipeline("error", "document_ai_invoice_rejected", {
          dealId: document.dealId,
          documentId: document.id,
          fileName: document.fileName,
          extractionRoute: routing.extractionRoute,
          reason,
          runId
        });
        throw new Error(`Document AI invoice extraction failed: ${reason}.`);
      }
    } else {
      logDocumentPipeline("error", "document_ai_route_unsupported", {
        dealId: document.dealId,
        documentId: document.id,
        fileName: document.fileName,
        extractionRoute: routing.extractionRoute,
        reasons: routing.reasons,
        runId
      });
      throw new Error(
        `Document AI extraction is not available for ${document.documentKind}: ${routing.reasons.join(", ")}.`
      );
    }
    const extractionEvidence = Array.isArray(sanitizedExtraction.evidence)
      ? sanitizedExtraction.evidence
      : [];

    logDocumentPipeline("info", "merge_complete", {
      dealId: document.dealId,
      documentId: document.id,
      evidenceCount: extractionEvidence.length,
      deliverablesCount: sanitizedExtraction.data.deliverables?.length ?? 0,
      hasPaymentAmount: sanitizedExtraction.data.paymentAmount !== null,
      hasBrandName: Boolean(sanitizedExtraction.data.brandName),
      hasCampaignName: Boolean(sanitizedExtraction.data.campaignName),
      runId
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
        confidence: entry.confidence
      }))
    );

    const normalizedArtifact = await saveArtifact({
      documentId: document.id,
      runId,
      step: "extract_fields",
      kind: "normalized_extraction",
      processor: sanitizedExtraction.model,
      payload: sanitizedExtraction
    });

    await repository.replaceDocumentFieldEvidence(
      document.id,
      runId,
      extractionEvidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        sourceType: getEvidenceSourceType(entry),
        sectionId: resolveSectionId(sections, entry.sectionKey),
        artifactId: rawVendorArtifactId ?? normalizedArtifact.id,
        confidence: entry.confidence
      }))
    );

    const reviewItems = buildReviewItems({
      extraction: sanitizedExtraction,
      sections,
      artifactId: normalizedArtifact.id
    });

    await repository.replaceDocumentReviewItems(
      document.id,
      runId,
      reviewItems
    );

    await saveObservabilityArtifact({
      documentId: document.id,
      runId,
      step: "extract_fields",
      processor: routeProcessor ?? sanitizedExtraction.model,
      payload: {
        event: "extract_fields_metrics",
        extractionRoute: routing.extractionRoute,
        processor: routeProcessor ?? routing.processor,
        usedFallback: false,
        pageCount,
        entityCount,
        evidenceCount: extractionEvidence.length,
        conflictCount: sanitizedExtraction.conflicts.length,
        reviewItemCount: reviewItems.length,
        confidence: sanitizedExtraction.confidence,
        estimatedCostUsd: estimateDocumentAiCostUsd(routing.processor, pageCount)
      }
    });

    return sanitizedExtraction;
  });
}
