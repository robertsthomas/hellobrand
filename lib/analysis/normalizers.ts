/**
 * LLM response normalization: type-safe parsing and cleaning of structured LLM output.
 */
import { mergeConflictIntelligence, normalizeDealCategory } from "@/lib/conflict-intelligence";
import { sanitizeCampaignName, sanitizePartyName } from "@/lib/party-labels";
import { normalizeEvidenceSnippet } from "@/lib/utils";
import type {
  CampaignDateWindow,
  DealTermsRecord,
  DisclosureObligation,
  FieldEvidence,
  GeneratedBriefSection,
  RiskFlagRecord
} from "@/lib/types";

type TermsData = Omit<
  DealTermsRecord,
  "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction"
>;

export function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

export function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(asString).filter((entry): entry is string => Boolean(entry));
}

export function asDateWindow(value: unknown): CampaignDateWindow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  return {
    startDate: asString(row.startDate),
    endDate: asString(row.endDate),
    postingWindow: asString(row.postingWindow)
  };
}

export function asDisclosureObligations(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const title = asString(row.title);
      const detail = asString(row.detail);
      if (!title || !detail) {
        return null;
      }

      const obligation: DisclosureObligation = {
        id: asString(row.id) ?? `llm-disclosure-${index}`,
        title,
        detail,
        source: asString(row.source)
      };

      return obligation;
    })
    .filter((entry): entry is DisclosureObligation => entry !== null);
}

export function normalizeDeliverables(
  value: unknown,
  fallbackDeliverables: TermsData["deliverables"]
) {
  if (!Array.isArray(value)) {
    return fallbackDeliverables;
  }

  const normalized = value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const title = asString(row.title);
      if (!title) {
        return null;
      }

      const status: TermsData["deliverables"][number]["status"] =
        row.status === "pending" ||
        row.status === "in_progress" ||
        row.status === "completed" ||
        row.status === "overdue"
          ? row.status
          : "pending";

      const normalizedEntry: TermsData["deliverables"][number] = {
        id: asString(row.id) || `llm-deliverable-${index}`,
        title,
        dueDate: asString(row.dueDate),
        channel: asString(row.channel),
        quantity: asNumber(row.quantity),
        status,
        description: asString(row.description)
      };

      return normalizedEntry;
    })
    .filter(
      (entry): entry is TermsData["deliverables"][number] => entry !== null
    );

  return normalized.length > 0 ? normalized : fallbackDeliverables;
}

export function normalizeTerms(
  rawData: unknown,
  fallbackData: TermsData
): TermsData {
  if (!rawData || typeof rawData !== "object") {
    return fallbackData;
  }

  const input = rawData as Record<string, unknown>;

  const mergedConflictIntelligence = mergeConflictIntelligence(fallbackData, {
    competitorCategories: asStringArray(input.competitorCategories),
    restrictedCategories: asStringArray(input.restrictedCategories),
    disclosureObligations: asDisclosureObligations(input.disclosureObligations),
    campaignDateWindow: asDateWindow(input.campaignDateWindow)
  });
  const llmBrandName = sanitizePartyName(asString(input.brandName), "brand");
  const llmAgencyName = sanitizePartyName(asString(input.agencyName), "agency");

  return {
    ...fallbackData,
    brandName: llmBrandName ?? fallbackData.brandName,
    agencyName: llmAgencyName ?? fallbackData.agencyName,
    creatorName: asString(input.creatorName) ?? fallbackData.creatorName,
    campaignName: sanitizeCampaignName(asString(input.campaignName)) ?? fallbackData.campaignName,
    paymentAmount: asNumber(input.paymentAmount) ?? fallbackData.paymentAmount,
    currency: asString(input.currency) ?? fallbackData.currency,
    paymentTerms: asString(input.paymentTerms) ?? fallbackData.paymentTerms,
    paymentStructure: asString(input.paymentStructure) ?? fallbackData.paymentStructure,
    netTermsDays: asNumber(input.netTermsDays) ?? fallbackData.netTermsDays,
    paymentTrigger: asString(input.paymentTrigger) ?? fallbackData.paymentTrigger,
    deliverables: normalizeDeliverables(input.deliverables, fallbackData.deliverables),
    usageRights: asString(input.usageRights) ?? fallbackData.usageRights,
    usageRightsOrganicAllowed:
      asBoolean(input.usageRightsOrganicAllowed) ?? fallbackData.usageRightsOrganicAllowed,
    usageRightsPaidAllowed:
      asBoolean(input.usageRightsPaidAllowed) ?? fallbackData.usageRightsPaidAllowed,
    whitelistingAllowed:
      asBoolean(input.whitelistingAllowed) ?? fallbackData.whitelistingAllowed,
    usageDuration: asString(input.usageDuration) ?? fallbackData.usageDuration,
    usageTerritory: asString(input.usageTerritory) ?? fallbackData.usageTerritory,
    usageChannels: Array.from(
      new Set([...fallbackData.usageChannels, ...asStringArray(input.usageChannels)])
    ),
    exclusivity: asString(input.exclusivity) ?? fallbackData.exclusivity,
    exclusivityApplies:
      asBoolean(input.exclusivityApplies) ?? fallbackData.exclusivityApplies,
    exclusivityCategory:
      asString(input.exclusivityCategory) ?? fallbackData.exclusivityCategory,
    exclusivityDuration:
      asString(input.exclusivityDuration) ?? fallbackData.exclusivityDuration,
    exclusivityRestrictions:
      asString(input.exclusivityRestrictions) ?? fallbackData.exclusivityRestrictions,
    brandCategory:
      normalizeDealCategory(asString(input.brandCategory)) ?? fallbackData.brandCategory,
    competitorCategories: mergedConflictIntelligence.competitorCategories,
    restrictedCategories: mergedConflictIntelligence.restrictedCategories,
    campaignDateWindow: mergedConflictIntelligence.campaignDateWindow,
    disclosureObligations: mergedConflictIntelligence.disclosureObligations,
    revisions: asString(input.revisions) ?? fallbackData.revisions,
    revisionRounds: asNumber(input.revisionRounds) ?? fallbackData.revisionRounds,
    termination: asString(input.termination) ?? fallbackData.termination,
    terminationAllowed:
      asBoolean(input.terminationAllowed) ?? fallbackData.terminationAllowed,
    terminationNotice:
      asString(input.terminationNotice) ?? fallbackData.terminationNotice,
    terminationConditions:
      asString(input.terminationConditions) ?? fallbackData.terminationConditions,
    governingLaw: asString(input.governingLaw) ?? fallbackData.governingLaw,
    notes: asString(input.notes) ?? fallbackData.notes
  };
}

export function normalizeEvidence(
  rawEvidence: unknown,
  sectionKey: string | null,
  fallbackEvidence: FieldEvidence[]
) {
  const sanitizedFallbackEvidence = fallbackEvidence
    .map((entry) => {
      const snippet = normalizeEvidenceSnippet(entry.snippet);
      if (!snippet) {
        return null;
      }

      return {
        ...entry,
        snippet
      };
    })
    .filter((entry): entry is FieldEvidence => Boolean(entry));

  if (!Array.isArray(rawEvidence)) {
    return sanitizedFallbackEvidence;
  }

  const evidence = rawEvidence
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const fieldPath = asString(row.fieldPath);
      const snippet = normalizeEvidenceSnippet(asString(row.snippet));
      if (!fieldPath || !snippet) {
        return null;
      }

      return {
        fieldPath,
        snippet,
        sectionKey,
        confidence: asNumber(row.confidence)
      };
    })
    .filter((entry): entry is FieldEvidence => Boolean(entry));

  return evidence.length > 0 ? evidence : sanitizedFallbackEvidence;
}

export function normalizeRiskFlags(
  raw: unknown,
  fallback: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>,
  documentId: string
): Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">> {
  const sanitizedFallback = fallback.map((flag) => ({
    ...flag,
    evidence: (Array.isArray(flag.evidence) ? flag.evidence : [])
      .map((snippet) => normalizeEvidenceSnippet(snippet))
      .filter((snippet): snippet is string => Boolean(snippet))
  }));

  if (!Array.isArray(raw)) {
    return sanitizedFallback;
  }

  const mapped: Array<
    Omit<RiskFlagRecord, "id" | "dealId" | "createdAt"> | null
  > = raw.map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const category = asString(row.category);
      const title = asString(row.title);
      const detail = asString(row.detail);
      const severity = asString(row.severity);

      if (!category || !title || !detail || !severity) {
        return null;
      }

      if (
        category !== "usage_rights" &&
        category !== "exclusivity" &&
        category !== "payment_terms" &&
        category !== "deliverables" &&
        category !== "termination" &&
        category !== "other"
      ) {
        return null;
      }

      if (severity !== "low" && severity !== "medium" && severity !== "high") {
        return null;
      }

      const sanitizedEvidence = asStringArray(row.evidence)
        .map((snippet) => normalizeEvidenceSnippet(snippet))
        .filter((snippet): snippet is string => Boolean(snippet));

      return {
        category: category as Omit<
          RiskFlagRecord,
          "id" | "dealId" | "createdAt"
        >["category"],
        title,
        detail,
        severity: severity as Omit<
          RiskFlagRecord,
          "id" | "dealId" | "createdAt"
        >["severity"],
        suggestedAction: asString(row.suggestedAction),
        evidence: sanitizedEvidence,
        sourceDocumentId: documentId
      };
    });

  const next = mapped.filter(
    (
      entry
    ): entry is Omit<RiskFlagRecord, "id" | "dealId" | "createdAt"> => entry !== null
  );

  return next.length > 0 ? next : sanitizedFallback;
}

export function normalizeBriefSections(raw: unknown): GeneratedBriefSection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const sections: GeneratedBriefSection[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const id = asString(row.id);
    const title = asString(row.title);
    const content = asString(row.content);

    if (!id || !title || !content) {
      continue;
    }

    const items = asStringArray(row.items);
    const section: GeneratedBriefSection = { id, title, content };
    if (items.length > 0) {
      section.items = items;
    }
    sections.push(section);
  }

  return sections;
}

export function buildBriefContext(aggregate: import("@/lib/types").DealAggregate) {
  const { deal, terms, riskFlags } = aggregate;
  const summary = aggregate.currentSummary?.body ?? deal.summary ?? null;

  const context: Record<string, unknown> = {
    brandName: terms?.brandName,
    campaignName: terms?.campaignName ?? deal.campaignName,
    summary,
    paymentAmount: terms?.paymentAmount,
    currency: terms?.currency,
    paymentTerms: terms?.paymentTerms,
    deliverables: terms?.deliverables?.map((d) => ({
      title: d.title,
      dueDate: d.dueDate,
      channel: d.channel,
      quantity: d.quantity,
      description: d.description
    })),
    usageRights: terms?.usageRights,
    usageDuration: terms?.usageDuration,
    usageChannels: terms?.usageChannels,
    exclusivity: terms?.exclusivity,
    exclusivityDuration: terms?.exclusivityDuration,
    exclusivityCategory: terms?.exclusivityCategory,
    campaignDateWindow: terms?.campaignDateWindow,
    briefData: terms?.briefData,
    riskFlags: riskFlags.map((f) => ({
      category: f.category,
      title: f.title,
      detail: f.detail,
      severity: f.severity
    }))
  };

  return JSON.stringify(context, null, 2);
}
