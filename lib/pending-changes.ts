import { humanizeToken } from "@/lib/utils";
import type {
  DealTermsRecord,
  PendingChangesSummary,
  PendingExtractionData,
  TermsDiffEntry
} from "@/lib/types";

const SKIP_FIELDS = new Set([
  "id",
  "dealId",
  "createdAt",
  "updatedAt",
  "manuallyEditedFields",
  "briefData",
  "pendingExtraction"
]);

const JSON_ARRAY_FIELDS = new Set([
  "deliverables",
  "usageChannels",
  "competitorCategories",
  "restrictedCategories",
  "disclosureObligations"
]);

const BOOLEAN_FIELDS = new Set([
  "usageRightsOrganicAllowed",
  "usageRightsPaidAllowed",
  "whitelistingAllowed",
  "exclusivityApplies",
  "terminationAllowed"
]);

const NUMBER_FIELDS = new Set([
  "paymentAmount",
  "netTermsDays",
  "revisionRounds"
]);

function fieldType(key: string): TermsDiffEntry["fieldType"] {
  if (JSON_ARRAY_FIELDS.has(key)) return "json_array";
  if (BOOLEAN_FIELDS.has(key)) return "boolean";
  if (NUMBER_FIELDS.has(key)) return "number";
  return "scalar";
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim().length === 0) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

// Identity fields where the current value should never be replaced with
// a shorter or more generic extraction result.
const IDENTITY_FIELDS = new Set(["brandName", "campaignName", "creatorName", "agencyName"]);

const GENERIC_VALUES = new Set([
  "workspace",
  "concept",
  "project",
  "campaign",
  "partnership",
  "untitled",
  "draft",
  "document",
  "contract",
  "agreement"
]);

function isWorseIdentityValue(field: string, current: unknown, proposed: unknown): boolean {
  if (!IDENTITY_FIELDS.has(field)) return false;
  if (typeof current !== "string" || typeof proposed !== "string") return false;

  const currentTrimmed = current.trim();
  const proposedTrimmed = proposed.trim();

  if (!currentTrimmed) return false;

  // Proposed is a generic placeholder
  if (GENERIC_VALUES.has(proposedTrimmed.toLowerCase())) return true;

  // Proposed is significantly shorter than current (likely lost information)
  if (proposedTrimmed.length < currentTrimmed.length * 0.4 && currentTrimmed.length > 5) return true;

  return false;
}

function valuesAreDifferent(current: unknown, proposed: unknown): boolean {
  if (isEmptyValue(current) && isEmptyValue(proposed)) return false;

  if (Array.isArray(current) || Array.isArray(proposed)) {
    return JSON.stringify(current) !== JSON.stringify(proposed);
  }

  if (
    typeof current === "object" &&
    current !== null &&
    typeof proposed === "object" &&
    proposed !== null
  ) {
    return JSON.stringify(current) !== JSON.stringify(proposed);
  }

  return current !== proposed;
}

export function computeTermsDiff(
  currentTerms: DealTermsRecord,
  pendingExtraction: PendingExtractionData
): PendingChangesSummary {
  const entries: TermsDiffEntry[] = [];
  const manuallyEdited = new Set(currentTerms.manuallyEditedFields ?? []);

  for (const key of Object.keys(pendingExtraction) as Array<
    keyof PendingExtractionData
  >) {
    if (SKIP_FIELDS.has(key)) continue;

    const currentValue = currentTerms[key as keyof DealTermsRecord];
    const proposedValue = pendingExtraction[key];

    if (!valuesAreDifferent(currentValue, proposedValue)) continue;
    if (isEmptyValue(proposedValue)) continue;

    // Don't suggest replacing good identity values with generic/worse ones
    if (isWorseIdentityValue(key, currentValue, proposedValue)) continue;

    entries.push({
      field: key,
      label: humanizeToken(key),
      currentValue,
      proposedValue,
      isManuallyEdited: manuallyEdited.has(key),
      fieldType: fieldType(key)
    });
  }

  return {
    hasPendingChanges: entries.length > 0,
    totalChangedFields: entries.length,
    manuallyEditedConflicts: entries.filter((e) => e.isManuallyEdited).length,
    entries
  };
}

export function hasMeaningfulChanges(
  currentTerms: DealTermsRecord,
  mergedExtraction: PendingExtractionData
): boolean {
  for (const key of Object.keys(mergedExtraction) as Array<
    keyof PendingExtractionData
  >) {
    if (SKIP_FIELDS.has(key)) continue;

    const currentValue = currentTerms[key as keyof DealTermsRecord];
    const proposedValue = mergedExtraction[key];

    if (isEmptyValue(proposedValue)) continue;
    if (isWorseIdentityValue(key, currentValue, proposedValue)) continue;
    if (valuesAreDifferent(currentValue, proposedValue)) return true;
  }

  return false;
}

export function coalesceExtractions(
  existingPending: PendingExtractionData,
  newExtraction: Partial<PendingExtractionData>,
  mergeTermsFn: (
    base: PendingExtractionData,
    patch: Partial<PendingExtractionData>
  ) => PendingExtractionData
): PendingExtractionData {
  return mergeTermsFn(existingPending, newExtraction);
}

export function buildAppliedTerms(
  currentTerms: DealTermsRecord,
  pendingExtraction: PendingExtractionData,
  acceptedFields: string[]
): Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt"> {
  const accepted = new Set(acceptedFields);
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(currentTerms) as Array<
    keyof DealTermsRecord
  >) {
    if (key === "id" || key === "dealId" || key === "createdAt" || key === "updatedAt") {
      continue;
    }

    if (key === "pendingExtraction") {
      result[key] = null;
      continue;
    }

    if (accepted.has(key) && key in pendingExtraction) {
      result[key] = pendingExtraction[key as keyof PendingExtractionData];
    } else {
      result[key] = currentTerms[key];
    }
  }

  return result as Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">;
}
