import { humanizeToken } from "@/lib/utils";
import type {
  DealTermsRecord,
  ExtractionPipelineResult,
  PendingChangesSummary,
  PendingExtractionData,
  TermsDiffEntry
} from "@/lib/types";

const INTERNAL_SKIP_FIELDS = new Set([
  "id",
  "dealId",
  "createdAt",
  "updatedAt",
  "manuallyEditedFields",
  "pendingExtraction"
]);

const DIFF_SKIP_FIELDS = new Set([...INTERNAL_SKIP_FIELDS, "briefData"]);

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

const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.8;

function topLevelField(fieldPath: string) {
  return fieldPath.split(".")[0] ?? fieldPath;
}

function toPendingExtractionData(terms: DealTermsRecord): PendingExtractionData {
  const {
    id: _id,
    dealId: _dealId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    pendingExtraction: _pendingExtraction,
    ...rest
  } = terms;

  return rest;
}

function setPendingField(
  target: PendingExtractionData,
  key: keyof PendingExtractionData,
  value: unknown
) {
  (target as Record<string, unknown>)[key] = value;
}

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
  "brief",
  "objective",
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

  if (
    currentTrimmed.toLowerCase() === proposedTrimmed.toLowerCase() &&
    currentTrimmed !== proposedTrimmed &&
    proposedTrimmed === proposedTrimmed.toLowerCase() &&
    currentTrimmed !== currentTrimmed.toLowerCase()
  ) {
    return true;
  }

  // Proposed is a generic placeholder (exact match)
  if (GENERIC_VALUES.has(proposedTrimmed.toLowerCase())) return true;

  // Proposed is composed entirely of generic words (e.g. "Campaign Concept")
  const proposedWords = proposedTrimmed.toLowerCase().split(/\s+/);
  if (proposedWords.length <= 3 && proposedWords.every((word) => GENERIC_VALUES.has(word))) return true;
  if (/\bcampaign objective\b/i.test(proposedTrimmed)) return true;

  // Proposed is significantly shorter than current (likely lost information)
  if (proposedTrimmed.length < currentTrimmed.length * 0.5 && currentTrimmed.length > 5) return true;

  // Proposed drops most of the current value's words (e.g. "Amazon Kids" -> "Alexa+")
  const currentWords = new Set(currentTrimmed.toLowerCase().split(/\s+/));
  const overlapCount = proposedWords.filter((word) => currentWords.has(word)).length;
  if (currentWords.size >= 2 && overlapCount === 0 && proposedTrimmed.length < currentTrimmed.length) return true;

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

// fallow-ignore-next-line complexity
function buildPendingCandidate(
  currentTerms: DealTermsRecord,
  extraction: ExtractionPipelineResult
) {
  const manuallyEdited = new Set(currentTerms.manuallyEditedFields ?? []);
  const conflicts = new Set((extraction.conflicts ?? []).map((fieldPath) => topLevelField(fieldPath)));
  const confidenceByField = new Map<string, number>();

  for (const evidence of extraction.evidence ?? []) {
    if (typeof evidence.confidence !== "number") {
      continue;
    }

    const field = topLevelField(evidence.fieldPath);
    const existing = confidenceByField.get(field);
    if (existing === undefined || evidence.confidence > existing) {
      confidenceByField.set(field, evidence.confidence);
    }
  }

  const result = toPendingExtractionData(currentTerms);

  for (const key of Object.keys(result) as Array<keyof PendingExtractionData>) {
    if (INTERNAL_SKIP_FIELDS.has(key)) {
      continue;
    }

    const proposedValue = extraction.data[key as keyof ExtractionPipelineResult["data"]];
    const currentValue = currentTerms[key as keyof DealTermsRecord];

    if (isEmptyValue(proposedValue)) {
      setPendingField(result, key, currentValue);
      continue;
    }

    if (isWorseIdentityValue(key, currentValue, proposedValue)) {
      setPendingField(result, key, currentValue);
      continue;
    }

    if (!valuesAreDifferent(currentValue, proposedValue)) {
      setPendingField(result, key, currentValue);
      continue;
    }

    const fieldConfidence = confidenceByField.get(key) ?? extraction.confidence ?? null;
    const requiresReview =
      conflicts.has(key) ||
      manuallyEdited.has(key) ||
      (typeof fieldConfidence === "number" && fieldConfidence < AUTO_APPLY_CONFIDENCE_THRESHOLD);

    setPendingField(result, key, requiresReview ? currentValue : proposedValue);
  }

  return result;
}

export function planExtractionMerge(
  currentTerms: DealTermsRecord,
  extraction: ExtractionPipelineResult
) {
  const autoApplied = buildPendingCandidate(currentTerms, extraction);
  const mergedTerms: PendingExtractionData = {
    ...toPendingExtractionData(currentTerms),
    ...autoApplied
  };

  const pending: PendingExtractionData = { ...mergedTerms };

  for (const key of Object.keys(pending) as Array<keyof PendingExtractionData>) {
    if (INTERNAL_SKIP_FIELDS.has(key)) {
      continue;
    }

    const proposedValue = extraction.data[key as keyof ExtractionPipelineResult["data"]];
    const mergedValue = mergedTerms[key];

    if (isEmptyValue(proposedValue)) {
      setPendingField(pending, key, mergedValue);
      continue;
    }

    if (isWorseIdentityValue(key, currentTerms[key as keyof DealTermsRecord], proposedValue)) {
      setPendingField(pending, key, mergedValue);
      continue;
    }

    setPendingField(
      pending,
      key,
      valuesAreDifferent(mergedValue, proposedValue) ? proposedValue : mergedValue
    );
  }

  return {
    autoApplied,
    pending,
    hasPendingChanges: hasMeaningfulChanges(
      {
        ...mergedTerms,
        id: currentTerms.id,
        dealId: currentTerms.dealId,
        createdAt: currentTerms.createdAt,
        updatedAt: currentTerms.updatedAt,
        pendingExtraction: currentTerms.pendingExtraction
      },
      pending
    )
  };
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
    if (DIFF_SKIP_FIELDS.has(key)) continue;

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
    if (INTERNAL_SKIP_FIELDS.has(key)) continue;

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
  const nextManualEdits = Array.from(
    new Set([...(currentTerms.manuallyEditedFields ?? []), ...acceptedFields])
  );
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

  result.manuallyEditedFields = nextManualEdits;

  return result as Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">;
}
