import { stripInlineMarkdown } from "@/lib/deal-summary";
import { isGenericWorkspaceLabel } from "@/lib/workspace-labels";

function presentDisplayText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDisplayLabel(value: string | null | undefined) {
  const normalized = presentDisplayText(stripInlineMarkdown(value ?? ""));
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(
      /\b(brand name|campaign|client name|agency name|creator name|talent manager\/agency name|referred as talent manager\/agency)\b[:\s-]*/gi,
      "",
    )
    .replace(/\(if any\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitDisplayDealLabelSegments(value: string | null | undefined) {
  const raw = presentDisplayText(value);
  if (!raw) {
    return [] as string[];
  }

  return raw
    .split(/\s+#{1,6}\s+|\n\s*#{1,6}\s*|\n{2,}/g)
    .map((segment) => normalizeDisplayLabel(segment))
    .filter((segment): segment is string => Boolean(segment));
}

function dedupeRepeatedCampaignSuffix(value: string | null | undefined) {
  const normalized = presentDisplayText(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/\s+-\s+/g).filter(Boolean);
  if (
    parts.length >= 2 &&
    parts[parts.length - 1]?.toLowerCase() === parts[parts.length - 2]?.toLowerCase()
  ) {
    return parts.slice(0, -1).join(" - ");
  }

  return normalized;
}

function formatDisplayBrandName(value: string | null | undefined) {
  const cleaned = splitDisplayDealLabelSegments(value)[0] ?? normalizeDisplayLabel(value);
  return cleaned && !isGenericWorkspaceLabel(cleaned) ? cleaned : null;
}

function formatDisplayCampaignName(
  value: string | null | undefined,
  brandName?: string | null | undefined,
) {
  const brand = formatDisplayBrandName(brandName);
  const segments = splitDisplayDealLabelSegments(value);
  const segmentBrand = formatDisplayBrandName(segments[0] ?? null);
  const cleanedCampaign = dedupeRepeatedCampaignSuffix(
    segments[segments.length - 1] ?? normalizeDisplayLabel(value),
  );
  const safeCampaign =
    cleanedCampaign && !isGenericWorkspaceLabel(cleanedCampaign)
      ? cleanedCampaign
      : null;

  const effectiveBrand = brand ?? segmentBrand;
  if (!safeCampaign) {
    return effectiveBrand && !isGenericWorkspaceLabel(effectiveBrand)
      ? effectiveBrand
      : null;
  }

  if (effectiveBrand && !safeCampaign.toLowerCase().includes(effectiveBrand.toLowerCase())) {
    return `${effectiveBrand} - ${safeCampaign}`;
  }

  return safeCampaign;
}

export function getDisplayDealLabels(input: {
  brandName?: string | null | undefined;
  campaignName?: string | null | undefined;
}) {
  const campaignSegments = splitDisplayDealLabelSegments(input.campaignName).filter(
    (segment) => !isGenericWorkspaceLabel(segment)
  );
  const brandName =
    formatDisplayBrandName(input.brandName) ??
    campaignSegments[0] ??
    null;
  const campaignName = formatDisplayCampaignName(input.campaignName, brandName);

  return {
    brandName,
    campaignName,
  };
}
