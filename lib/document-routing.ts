import { classifyDocumentHeuristically } from "@/lib/analysis/fallback";
import { hasDocumentAiProcessor } from "@/lib/document-ai";
import type { DocumentAiProcessorKind } from "@/lib/document-ai";
import type {
  DocumentClassificationResult,
  DocumentKind,
  DocumentRecord
} from "@/lib/types";

export type DocumentExtractionRoute =
  | "legacy"
  | "document_ai_invoice"
  | "document_ai_contract"
  | "document_ai_brief";

export interface DocumentRoutingDecision {
  classification: DocumentClassificationResult;
  extractionRoute: DocumentExtractionRoute;
  processor: DocumentAiProcessorKind | null;
  fallbackRoute: DocumentExtractionRoute | null;
  reasons: string[];
}

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function countInvoiceSignals(text: string, fileName: string) {
  const lower = `${fileName}\n${text}`.toLowerCase();
  const patterns = [
    /\binvoice\b/,
    /\binvoice number\b/,
    /\bamount due\b/,
    /\bbill to\b/,
    /\bdue date\b/,
    /\bbalance due\b/
  ];

  return patterns.reduce((count, pattern) => count + (pattern.test(lower) ? 1 : 0), 0);
}

export function classifyDocumentForRouting(input: {
  text: string;
  fileName?: string | null;
}) {
  const fileName = normalizeString(input.fileName);
  const invoiceSignals = countInvoiceSignals(input.text, fileName);

  if (invoiceSignals >= 2) {
    return {
      documentKind: "invoice" as DocumentKind,
      confidence: 0.96
    };
  }

  return classifyDocumentHeuristically(input.text, fileName);
}

export function resolveDocumentRoutingDecision(input: {
  document:
    | Pick<
        DocumentRecord,
        "documentKind" | "classificationConfidence" | "fileName" | "normalizedText" | "sourceType"
      >
    | null;
}) {
  if (!input.document) {
    throw new Error("Document is required for routing.");
  }

  const classification = {
    documentKind: input.document.documentKind,
    confidence: input.document.classificationConfidence
  };
  const reasons: string[] = [`classified:${classification.documentKind}`];

  if (classification.documentKind === "invoice") {
    if (input.document.sourceType === "pasted_text") {
      reasons.push("invoice_processor_requires_file");
      return {
        classification,
        extractionRoute: "legacy" as const,
        processor: null,
        fallbackRoute: null,
        reasons
      };
    }

    if (hasDocumentAiProcessor("invoice")) {
      reasons.push("document_ai_invoice_processor_configured");
      return {
        classification,
        extractionRoute: "document_ai_invoice" as const,
        processor: "invoice" as const,
        fallbackRoute: "legacy" as const,
        reasons
      };
    }

    reasons.push("document_ai_invoice_processor_missing");
  }

  if (classification.documentKind === "contract") {
    if (input.document.sourceType === "pasted_text") {
      reasons.push("contract_processor_requires_file");
      return {
        classification,
        extractionRoute: "legacy" as const,
        processor: null,
        fallbackRoute: null,
        reasons
      };
    }

    if (hasDocumentAiProcessor("contract")) {
      reasons.push("document_ai_contract_processor_configured");
      return {
        classification,
        extractionRoute: "document_ai_contract" as const,
        processor: "contract" as const,
        fallbackRoute: "legacy" as const,
        reasons
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
        extractionRoute: "legacy" as const,
        processor: null,
        fallbackRoute: null,
        reasons
      };
    }

    if (hasDocumentAiProcessor("brief")) {
      reasons.push("document_ai_brief_processor_configured");
      return {
        classification,
        extractionRoute: "document_ai_brief" as const,
        processor: "brief" as const,
        fallbackRoute: "legacy" as const,
        reasons
      };
    }

    reasons.push("document_ai_brief_processor_missing");
  }

  return {
    classification,
    extractionRoute: "legacy" as const,
    processor: null,
    fallbackRoute: null,
    reasons
  };
}
