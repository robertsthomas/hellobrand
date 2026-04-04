import { stripInlineMarkdown } from "@/lib/deal-summary";
import { isGenericWorkspaceLabel } from "@/lib/workspace-labels";

function presentText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePartyLabel(value: string | null | undefined) {
  const raw = presentText(value);
  if (!raw) {
    return null;
  }

  const normalized = presentText(
    stripInlineMarkdown(
      raw
        .split(/\s+#{1,6}\s+|\n\s*#{1,6}\s*|\n{2,}/g)
        .map((segment) => segment.trim())
        .find(Boolean) ?? raw
    )
  );
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(
      /\b(agency or management company|talent manager\/agency name|referred as talent manager\/agency|primary contact name|contact name|management company|manager\/agency|agency name|creator name|client name|brand name|agency|client|brand)\b[:\s-]*/gi,
      ""
    )
    .replace(/\(if any\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function looksSentenceLike(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 8) {
    return true;
  }

  if (/[.!?]/.test(value)) {
    return true;
  }

  const lower = value.toLowerCase();
  return (
    words.length > 5 &&
    /\b(your|their|this|that|these|those|should|would|could|will|may|might|must|able|because|payments?|subsidized|government)\b/.test(
      lower
    )
  );
}

export function sanitizePartyName(
  value: string | null | undefined,
  kind: "brand" | "agency"
) {
  const normalized = normalizePartyLabel(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  if (
    isGenericWorkspaceLabel(normalized) ||
    /^(name|company|contact|primary contact|unknown|not specified|not found|none|null|n\/a)$/i.test(
      normalized
    )
  ) {
    return null;
  }

  if (
    kind === "brand" &&
    /^(brand|brand name|client|client name|campaign|project|workspace|concept|overview|campaign brief|partnership|influencer|creator|content creator|talent|brand contact)$/i.test(
      normalized
    )
  ) {
    return null;
  }

  if (
    kind === "agency" &&
    /^(agency|agency name|management company|agency or management company|manager\/agency|brand contact)$/i.test(
      normalized
    )
  ) {
    return null;
  }

  if (/^(if|leave|optional|use|enter|type)\b/i.test(lower)) {
    return null;
  }

  if (looksSentenceLike(normalized)) {
    return null;
  }

  return normalized;
}
