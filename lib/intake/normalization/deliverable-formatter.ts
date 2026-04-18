/**
 * Deliverable title cleanup helpers for intake normalization.
 * These functions trim mixed brief/contract rows down to the readable deliverable portion.
 */

function presentText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

const DELIVERABLE_START_PATTERNS = [
  /#\s*of\s*posts?\s*\/\s*content\s*type\b[:\s-]*/i,
  /\bcontent\s*type\b[:\s-]*/i,
  /\bdeliverables?\b[:\s-]*/i,
] as const;

const DELIVERABLE_END_PATTERNS = [
  /\bconcept submission\b/i,
  /\bfirst draft(?: content)? submission\b/i,
  /\bdraft submission\b/i,
  /\bcontent live\b/i,
  /\bcampaign live\b/i,
  /\bgo live\b/i,
  /\bpost duration\b/i,
  /\ball dates subject to change\b/i,
  /\bsubject to change with written notice\b/i,
] as const;

function sliceAfterFirstMatch(value: string, patterns: readonly RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (!match) {
      continue;
    }

    return value.slice(match.index + match[0].length).trim();
  }

  return value;
}

function sliceBeforeFirstMatch(value: string, patterns: readonly RegExp[]) {
  let endIndex = value.length;

  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (!match) {
      continue;
    }

    endIndex = Math.min(endIndex, match.index);
  }

  return value.slice(0, endIndex).trim();
}

function stripLeadingHandle(value: string) {
  return value
    .replace(/^(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9.-]+\.)?[a-z]{2,}\/[a-z0-9._-]+\s+/i, "")
    .replace(/^@[a-z0-9._-]+\s+/i, "")
    .trim();
}

export function formatDeliverableTitle(
  title: string | null | undefined,
  source?: string | null | undefined
) {
  const raw = presentText(title) ?? presentText(source);
  if (!raw) {
    return null;
  }

  const fromMarker = sliceAfterFirstMatch(raw, DELIVERABLE_START_PATTERNS);
  const deliverablePortion = sliceBeforeFirstMatch(fromMarker, DELIVERABLE_END_PATTERNS);
  const withoutHandle = stripLeadingHandle(deliverablePortion);

  const cleaned = withoutHandle
    .replace(/^\*+/, "")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s{2,}/g, " ")
    .replace(/[,*;\s]+$/g, "")
    .trim();

  return presentText(cleaned) ?? presentText(raw);
}
