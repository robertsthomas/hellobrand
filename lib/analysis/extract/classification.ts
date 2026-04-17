/**
 * Heuristic document classification and sectioning.
 * This file owns file-level kind detection and fallback section creation.
 */
import type { DocumentClassificationResult, DocumentKind, DocumentSectionInput } from "@/lib/types";

import { inferSectionTitle } from "./shared";

const MIN_SECTION_CHARS_BY_KIND: Partial<Record<DocumentKind, number>> = {
  contract: 180,
  invoice: 140,
  deliverables_brief: 180,
  campaign_brief: 180,
  pitch_deck: 250,
  email_thread: 160,
  unknown: 160
};

const MAX_SECTION_CHARS_BY_KIND: Partial<Record<DocumentKind, number>> = {
  contract: 1800,
  invoice: 1200,
  deliverables_brief: 1600,
  campaign_brief: 1600,
  pitch_deck: 1200,
  email_thread: 1400,
  unknown: 1600
};

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

// fallow-ignore-next-line complexity
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

  const initialSections =
    sections.length > 0
      ? sections
      : [
          {
            title: "General",
            content: text,
            chunkIndex: 0,
            pageRange: null
          }
        ];

  const minSectionChars = MIN_SECTION_CHARS_BY_KIND[documentKind] ?? 300;
  const maxSectionChars = MAX_SECTION_CHARS_BY_KIND[documentKind] ?? 1600;
  const mergedSections: DocumentSectionInput[] = [];

  for (const section of initialSections) {
    const previous = mergedSections[mergedSections.length - 1];

    if (!previous) {
      mergedSections.push(section);
      continue;
    }

    const previousIsSmall = previous.content.length < minSectionChars;
    const currentIsVerySmall = section.content.length < Math.floor(minSectionChars / 2);
    const combinedFits = previous.content.length + section.content.length + 2 <= maxSectionChars;
    const weakBoundary =
      previous.title === section.title ||
      previous.title === "General" ||
      section.title === "General";

    if (weakBoundary && (previousIsSmall || currentIsVerySmall) && combinedFits) {
      previous.content = `${previous.content}\n\n${section.content}`;
      if (previous.title === "General" && section.title !== "General") {
        previous.title = section.title;
      }
      continue;
    }

    mergedSections.push(section);
  }

  if (mergedSections.length > 1) {
    const lastSection = mergedSections[mergedSections.length - 1];
    const previous = mergedSections[mergedSections.length - 2];
    const combinedFits =
      previous.content.length + lastSection.content.length + 2 <= maxSectionChars;
    const weakBoundary =
      previous.title === lastSection.title ||
      previous.title === "General" ||
      lastSection.title === "General";

    if (weakBoundary && lastSection.content.length < minSectionChars && combinedFits) {
      previous.content = `${previous.content}\n\n${lastSection.content}`;
      mergedSections.pop();
    }
  }

  return mergedSections.map((section, index) => ({
    ...section,
    chunkIndex: index
  }));
}
