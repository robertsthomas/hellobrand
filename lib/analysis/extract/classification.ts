/**
 * Heuristic document classification and sectioning.
 * This file owns file-level kind detection and fallback section creation.
 */
import type { DocumentClassificationResult, DocumentKind, DocumentSectionInput } from "@/lib/types";

import { inferSectionTitle } from "./shared";

export function classifyDocumentHeuristically(
  text: string,
  fileName = ""
): DocumentClassificationResult {
  const lower = `${fileName}\n${text}`.toLowerCase();

  if (
    /invoice number|amount due|bill to|balance due/.test(lower) ||
    (/\binvoice\b/.test(lower) && /\bdue date\b/.test(lower))
  ) {
    return { documentKind: "invoice", confidence: 0.92 };
  }

  if (
    /governing law|indemnif|term and termination|compensation|brand shall pay|creator agreement|agreement/.test(
      lower
    )
  ) {
    return { documentKind: "contract", confidence: 0.95 };
  }

  if (/deliverables|content requirements|posting schedule|asset delivery/.test(lower)) {
    return { documentKind: "deliverables_brief", confidence: 0.86 };
  }

  if (/campaign overview|creative concept|key messaging|timeline|brief/.test(lower)) {
    return { documentKind: "campaign_brief", confidence: 0.76 };
  }

  if (/slide|deck|audience insights|brand positioning/.test(lower)) {
    return { documentKind: "pitch_deck", confidence: 0.68 };
  }

  if (/from:|subject:|hi |thanks for sending|best,|regards,/.test(lower)) {
    return { documentKind: "email_thread", confidence: 0.7 };
  }

  return { documentKind: "unknown", confidence: 0.4 };
}

export function splitIntoSections(
  text: string,
  documentKind: DocumentKind
): DocumentSectionInput[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sections = blocks.map((block, index) => {
    const lines = block.split("\n").filter(Boolean);
    const firstLine = lines[0] ?? "";
    const title =
      lines.length > 1 &&
      firstLine.length < 80 &&
      /^[A-Z0-9][A-Za-z0-9/&'(),\- ]+$/.test(firstLine)
        ? firstLine
        : inferSectionTitle(block, documentKind);

    return {
      title,
      content: block,
      chunkIndex: index,
      pageRange: null
    };
  });

  return sections.length > 0
    ? sections
    : [
        {
          title: "General",
          content: text,
          chunkIndex: 0,
          pageRange: null
        }
      ];
}
