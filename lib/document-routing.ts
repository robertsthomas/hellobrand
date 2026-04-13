import { classifyDocumentHeuristically } from "@/lib/analysis/fallback";
import type { DocumentClassificationResult, DocumentKind, DocumentRecord } from "@/lib/types";

export type DocumentExtractionRoute = "fallback";

export interface DocumentRoutingDecision {
  classification: DocumentClassificationResult;
  extractionRoute: DocumentExtractionRoute;
  processor: string | null;
  rolloutEnabled: true;
  cohortBucket: 0;
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
  return {
    classification,
    extractionRoute: "fallback" as const,
    processor: null,
    rolloutEnabled: true,
    cohortBucket: 0,
    reasons: [`classified:${classification.documentKind}`, "extractor:fallback"],
  };
}
