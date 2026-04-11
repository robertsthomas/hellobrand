/**
 * Heuristic structured-term extraction.
 * This file turns sectioned text into extracted deal terms and merges the section-level results.
 */
import type { DocumentKind, DocumentSectionInput } from "@/lib/types";

import { extractStructuredTermsFromSection, mergeExtractionResults } from "./shared";

export function extractStructuredTerms(
  text: string,
  sections: DocumentSectionInput[],
  documentKind: DocumentKind
) {
  const parts = sections.map((section) =>
    extractStructuredTermsFromSection(section, documentKind)
  );

  if (parts.length === 0) {
    return mergeExtractionResults([
      extractStructuredTermsFromSection(
        { title: "General", content: text, chunkIndex: 0, pageRange: null },
        documentKind
      )
    ]);
  }

  return mergeExtractionResults(parts);
}
