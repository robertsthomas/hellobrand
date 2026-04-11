import { classifyDocumentHeuristically } from "@/lib/analysis/fallback";
import { hasDocumentAiProcessor } from "@/lib/document-ai";
import type { DocumentAiProcessorKind } from "@/lib/document-ai";
import { evaluateDocumentPipelineRollout } from "@/lib/document-pipeline-rollout";
import type { DocumentClassificationResult, DocumentKind, DocumentRecord } from "@/lib/types";

export type DocumentExtractionRoute =
  | "unsupported"
  | "document_ai_invoice"
  | "document_ai_contract"
  | "document_ai_brief";

export interface DocumentRoutingDecision {
  classification: DocumentClassificationResult;
  extractionRoute: DocumentExtractionRoute;
  processor: DocumentAiProcessorKind | null;
  rolloutEnabled: boolean;
  cohortBucket: number;
  reasons: string[];
}

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isPdf(mimeType: string | null | undefined, fileName: string | null | undefined) {
  return mimeType === "application/pdf" || (fileName?.toLowerCase().endsWith(".pdf") ?? false);
}

function countInvoiceSignals(text: string, fileName: string) {
  const lower = `${fileName}\n${text}`.toLowerCase();
  const patterns = [
    /\binvoice\b/,
    /\binvoice number\b/,
    /\bamount due\b/,
    /\bbill to\b/,
    /\bdue date\b/,
    /\bbalance due\b/,
  ];

  return patterns.reduce((count, pattern) => count + (pattern.test(lower) ? 1 : 0), 0);
}

export function classifyDocumentForRouting(input: { text: string; fileName?: string | null }) {
  const fileName = normalizeString(input.fileName);
  const invoiceSignals = countInvoiceSignals(input.text, fileName);

  if (invoiceSignals >= 2) {
    return {
      documentKind: "invoice" as DocumentKind,
      confidence: 0.96,
    };
  }

  return classifyDocumentHeuristically(input.text, fileName);
}

export function resolveDocumentRoutingDecision(input: {
  document: Pick<
    DocumentRecord,
    | "id"
    | "dealId"
    | "userId"
    | "documentKind"
    | "classificationConfidence"
    | "fileName"
    | "mimeType"
    | "normalizedText"
    | "sourceType"
  > | null;
}) {
  if (!input.document) {
    throw new Error("Document is required for routing.");
  }

  const classification = {
    documentKind: input.document.documentKind,
    confidence: input.document.classificationConfidence,
  };
  const reasons: string[] = [`classified:${classification.documentKind}`];
  const rollout = evaluateDocumentPipelineRollout({
    documentKind: classification.documentKind,
    dealId: input.document.dealId,
    documentId: input.document.id,
    userId: input.document.userId,
    fileName: input.document.fileName,
  });

  reasons.push(...rollout.reasons.map((reason) => `rollout:${reason}`));

  if (!rollout.enabled) {
    return {
      classification,
      extractionRoute: "unsupported" as const,
      processor: null,
      rolloutEnabled: false,
      cohortBucket: rollout.cohortBucket,
      reasons,
    };
  }

  if (classification.documentKind === "invoice") {
    if (input.document.sourceType === "pasted_text") {
      reasons.push("invoice_processor_requires_file");
      return {
        classification,
        extractionRoute: "unsupported" as const,
        processor: null,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    if (!isPdf(input.document.mimeType, input.document.fileName)) {
      reasons.push("invoice_processor_requires_pdf");
      return {
        classification,
        extractionRoute: "unsupported" as const,
        processor: null,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    if (hasDocumentAiProcessor("invoice")) {
      reasons.push("document_ai_invoice_processor_configured");
      return {
        classification,
        extractionRoute: "document_ai_invoice" as const,
        processor: "invoice" as const,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    reasons.push("document_ai_invoice_processor_missing");
  }

  if (classification.documentKind === "contract") {
    if (input.document.sourceType === "pasted_text") {
      reasons.push("contract_processor_requires_file");
      return {
        classification,
        extractionRoute: "unsupported" as const,
        processor: null,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    if (!isPdf(input.document.mimeType, input.document.fileName)) {
      reasons.push("contract_processor_requires_pdf");
      return {
        classification,
        extractionRoute: "unsupported" as const,
        processor: null,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    if (hasDocumentAiProcessor("contract")) {
      reasons.push("document_ai_contract_processor_configured");
      return {
        classification,
        extractionRoute: "document_ai_contract" as const,
        processor: "contract" as const,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    reasons.push("document_ai_contract_processor_missing");
  }

  if (
    classification.documentKind === "campaign_brief" ||
    classification.documentKind === "deliverables_brief" ||
    classification.documentKind === "pitch_deck"
  ) {
    if (input.document.sourceType === "pasted_text") {
      reasons.push("brief_processor_requires_file");
      return {
        classification,
        extractionRoute: "unsupported" as const,
        processor: null,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    if (!isPdf(input.document.mimeType, input.document.fileName)) {
      reasons.push("brief_processor_requires_pdf");
      return {
        classification,
        extractionRoute: "unsupported" as const,
        processor: null,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    if (hasDocumentAiProcessor("brief")) {
      reasons.push("document_ai_brief_processor_configured");
      return {
        classification,
        extractionRoute: "document_ai_brief" as const,
        processor: "brief" as const,
        rolloutEnabled: true,
        cohortBucket: rollout.cohortBucket,
        reasons,
      };
    }

    reasons.push("document_ai_brief_processor_missing");
  }

  return {
    classification,
    extractionRoute: "unsupported" as const,
    processor: null,
    rolloutEnabled: true,
    cohortBucket: rollout.cohortBucket,
    reasons,
  };
}
