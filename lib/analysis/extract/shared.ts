/**
 * Shared heuristic extraction helpers.
 * This file holds the low-level parsing and evidence utilities used by the brief, classification, and term extraction modules.
 */
import { randomUUID } from "node:crypto";

import {
  buildConflictIntelligencePatch,
  mergeConflictIntelligence
} from "@/lib/conflict-intelligence";
import { sanitizeCampaignName, sanitizePartyName } from "@/lib/party-labels";
import { normalizeEvidenceSnippet } from "@/lib/utils";
import type {
  DealTermsRecord,
  DeliverableItem,
  DocumentKind,
  DocumentSectionInput,
  ExtractionPipelineResult,
  FieldEvidence
} from "@/lib/types";

export function createEmptyTerms(): Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt"> {
  return {
    brandName: null,
    agencyName: null,
    creatorName: null,
    campaignName: null,
    paymentAmount: null,
    currency: null,
    paymentTerms: null,
    paymentStructure: null,
    netTermsDays: null,
    paymentTrigger: null,
    deliverables: [],
    usageRights: null,
    usageRightsOrganicAllowed: null,
    usageRightsPaidAllowed: null,
    whitelistingAllowed: null,
    usageDuration: null,
    usageTerritory: null,
    usageChannels: [],
    exclusivity: null,
    exclusivityApplies: null,
    exclusivityCategory: null,
    exclusivityDuration: null,
    exclusivityRestrictions: null,
    brandCategory: null,
    competitorCategories: [],
    restrictedCategories: [],
    campaignDateWindow: null,
    disclosureObligations: [],
    revisions: null,
    revisionRounds: null,
    termination: null,
    terminationAllowed: null,
    terminationNotice: null,
    terminationConditions: null,
    governingLaw: null,
    notes: null,
    manuallyEditedFields: [],
    briefData: null,
    pendingExtraction: null
  };
}

export function sentenceAround(text: string, index: number) {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  const nextPeriod = text.indexOf(".", index);
  const end = nextPeriod === -1 ? text.length : nextPeriod + 1;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function firstMatch(
  text: string,
  pattern: RegExp
): { value: string; index: number } | null {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) {
    return null;
  }

  return { value: match[1] ?? match[0], index: match.index };
}

export function pushEvidence(
  evidence: FieldEvidence[],
  fieldPath: string,
  snippet: string | null,
  sectionKey: string | null,
  confidence = 0.7
) {
  const normalizedSnippet = normalizeEvidenceSnippet(snippet);
  if (!normalizedSnippet) {
    return;
  }

  evidence.push({
    fieldPath,
    snippet: normalizedSnippet,
    sectionKey,
    confidence
  });
}

export function findSectionByKeyword(sections: DocumentSectionInput[], keywords: string[]) {
  return (
    sections.find((section) =>
      keywords.some((keyword) =>
        section.title.toLowerCase().includes(keyword) ||
        section.content.toLowerCase().includes(keyword)
      )
    ) ?? null
  );
}

export function parseCurrencyAmount(text: string) {
  const match = firstMatch(text, /\$ ?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i);
  if (!match) {
    return null;
  }

  return {
    amount: Number(match.value.replace(/,/g, "")),
    currency: "USD",
    snippet: sentenceAround(text, match.index)
  };
}

export function parseNetTerms(text: string) {
  const match = firstMatch(text, /\bnet[\s-]?(\d{1,3})\b/i);
  if (!match) {
    return null;
  }

  return {
    paymentTerms: `Net ${match.value}`,
    netTermsDays: Number(match.value),
    snippet: sentenceAround(text, match.index)
  };
}

export function parsePaymentStructure(text: string) {
  const splitSentence = text.match(
    /(\d{1,3}%[^.\n]{0,120}?\b(?:and|,)\s*\d{1,3}%[^.\n]{0,120})/i
  );
  const splitSnippet = splitSentence?.[1] ?? null;
  const splitLower = splitSnippet?.toLowerCase() ?? "";

  if (splitSnippet && splitLower.includes("signature")) {
    const firstPercent = splitSnippet.match(/(\d{1,3})%/i)?.[1] ?? null;
    const percentMatches = [...splitSnippet.matchAll(/(\d{1,3})%/gi)];
    const lastPercent = percentMatches.at(-1)?.[1] ?? null;

    if (firstPercent && lastPercent) {
      if (
        /final live links|final post|completion|delivery|deliverable|posting/.test(splitLower)
      ) {
        return {
          value: `${firstPercent}% on signature, ${lastPercent}% on completion`,
          snippet: normalizeEvidenceSnippet(splitSnippet) ?? splitSnippet
        };
      }

      return {
        value: `${firstPercent}% on signature, ${lastPercent}% milestone-based`,
        snippet: normalizeEvidenceSnippet(splitSnippet) ?? splitSnippet
      };
    }
  }

  if (/flat fee|one-time fee/i.test(text)) {
    const match = firstMatch(text, /(flat fee|one-time fee)/i);
    if (match) {
      return {
        value: "Flat fee",
        snippet: sentenceAround(text, match.index)
      };
    }
  }

  return null;
}

export function parsePaymentTrigger(text: string) {
  const lower = text.toLowerCase();

  if (/signature/.test(lower) && /final live links/.test(lower)) {
    const match = firstMatch(text, /signature[^.\n]{0,120}final live links/i);
    return {
      value: "On signature and after final live links",
      snippet: match ? sentenceAround(text, match.index) : sentenceAround(text, 0)
    };
  }

  if (/after invoice|upon receipt of invoice/i.test(lower)) {
    const match = firstMatch(text, /(after invoice|upon receipt of invoice)/i);
    return {
      value: "After invoice receipt",
      snippet: match ? sentenceAround(text, match.index) : null
    };
  }

  if (/after final live links|upon final live links/i.test(lower)) {
    const match = firstMatch(text, /(after final live links|upon final live links)/i);
    return {
      value: "After final live links",
      snippet: match ? sentenceAround(text, match.index) : null
    };
  }

  if (/upon posting|after posting|after final post|upon final post/i.test(lower)) {
    const match = firstMatch(text, /(upon posting|after posting|after final post|upon final post)/i);
    return {
      value: "After posting",
      snippet: match ? sentenceAround(text, match.index) : null
    };
  }

  if (/on signature|upon signature/i.test(lower)) {
    const match = firstMatch(text, /(on signature|upon signature)/i);
    return {
      value: "On signature",
      snippet: match ? sentenceAround(text, match.index) : null
    };
  }

  return null;
}

export function parseDuration(text: string, keyword: string) {
  const pattern = new RegExp(
    `${keyword}[^.\\n]{0,80}?(\\d+\\s*(?:day|days|week|weeks|month|months|year|years))`,
    "i"
  );
  const match = firstMatch(text, pattern);
  if (!match) {
    return null;
  }

  return {
    value: match.value,
    snippet: sentenceAround(text, match.index)
  };
}

export function parseNameAfterLabel(text: string, labels: string[]) {
  const labelPattern = labels.join("|");
  const match = text.match(
    new RegExp(`(?:${labelPattern})\\s*[:\\-]\\s*([A-Z][A-Za-z0-9&'().,\\- ]{2,80})`, "i")
  );
  if (!match?.[1]) {
    return null;
  }

  const value = sanitizePartyName(match[1], labels[0] === "agency" ? "agency" : "brand");
  if (!value) {
    return null;
  }

  return {
    value,
    snippet: normalizeEvidenceSnippet(match[0]) ?? match[0]
  };
}

export function parseRevisionRounds(text: string) {
  const explicitRounds = firstMatch(text, /(\d+)\s+(?:rounds?|revisions?)/i);
  if (explicitRounds) {
    return {
      revisions: `${explicitRounds.value} rounds`,
      revisionRounds: Number(explicitRounds.value),
      snippet: sentenceAround(text, explicitRounds.index)
    };
  }

  if (/one round|single round/i.test(text)) {
    const match = firstMatch(text, /(one round|single round)/i);
    return {
      revisions: "1 round",
      revisionRounds: 1,
      snippet: match ? sentenceAround(text, match.index) : null
    };
  }

  return null;
}

function inferDateNear(text: string, startIndex: number) {
  const window = text.slice(Math.max(0, startIndex - 80), startIndex + 120);
  const match = window.match(
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s+\d{4})?|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i
  );
  return match?.[0] ?? null;
}

export function parseDeliverables(text: string, evidence: FieldEvidence[]) {
  const deliverables: DeliverableItem[] = [];
  const seen = new Set<string>();
  const patterns = [
    { pattern: /\b(?:\d+\s*x\s*)?(?:ig|instagram)\s+reels?\b/i, title: "Instagram Reel", channel: "Instagram" },
    { pattern: /\b(?:\d+\s*x\s*)?(?:ig|instagram)\s+stories?\b/i, title: "Instagram Story", channel: "Instagram" },
    { pattern: /\b(?:\d+\s*x\s*)?tiktok\b/i, title: "TikTok", channel: "TikTok" },
    { pattern: /\b(?:\d+\s*x\s*)?youtube\b/i, title: "YouTube", channel: "YouTube" },
    { pattern: /\b(?:\d+\s*x\s*)?static\s+post\b/i, title: "Static Post", channel: "Instagram" }
  ];

  for (const { pattern, title, channel } of patterns) {
    const match = pattern.exec(text);
    if (!match || seen.has(title)) {
      continue;
    }

    const quantityMatch = match[0].match(/(\d+)\s*x/i);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    const dueDate = inferDateNear(text, match.index ?? 0);

    deliverables.push({
      id: randomUUID(),
      title,
      dueDate,
      channel,
      quantity,
      status: "pending",
      description: sentenceAround(text, match.index ?? 0)
    });
    seen.add(title);

    pushEvidence(
      evidence,
      "deliverables",
      sentenceAround(text, match.index ?? 0),
      null,
      0.82
    );
  }

  return deliverables;
}

export function getTopDocumentLines(text: string, count = 6) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

export function isBriefLikeDocumentKind(documentKind: DocumentKind) {
  return (
    documentKind === "campaign_brief" ||
    documentKind === "deliverables_brief" ||
    documentKind === "pitch_deck"
  );
}

export function isGenericCampaignName(value: string | null | undefined) {
  return sanitizeCampaignName(value) === null;
}

export function inferSectionTitle(content: string, kind: DocumentKind) {
  const lower = content.toLowerCase();

  if (/compensation|payment|fee|invoice/.test(lower)) {
    return "Compensation";
  }
  if (/deliverable|story|reel|tiktok|youtube|posting/.test(lower)) {
    return "Deliverables";
  }
  if (/usage|license|paid social|paid media|whitelist/.test(lower)) {
    return "Usage Rights";
  }
  if (/exclusive|exclusivity/.test(lower)) {
    return "Exclusivity";
  }
  if (/terminat|cancel/.test(lower)) {
    return "Termination";
  }
  if (/invoice|amount due/.test(lower)) {
    return "Invoice";
  }

  if (kind === "email_thread") {
    return "Email Notes";
  }

  return "General";
}

export function isSectionRelevant(section: DocumentSectionInput, keywords: string[]) {
  const lowerTitle = section.title.toLowerCase();
  const lowerContent = section.content.toLowerCase();

  return keywords.some(
    (keyword) => lowerTitle.includes(keyword) || lowerContent.includes(keyword)
  );
}

export function buildUsageRightsSummary(terms: ReturnType<typeof createEmptyTerms>) {
  const parts: string[] = [];
  if (terms.usageRightsOrganicAllowed) {
    parts.push("organic reposting");
  }
  if (terms.usageRightsPaidAllowed) {
    parts.push("paid usage");
  }
  if (terms.whitelistingAllowed) {
    parts.push("whitelisting");
  }

  if (terms.usageDuration) {
    parts.push(`for ${terms.usageDuration}`);
  }

  if (terms.usageTerritory) {
    parts.push(`in ${terms.usageTerritory}`);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function extractStructuredTermsFromSection(
  section: DocumentSectionInput,
  documentKind: DocumentKind
) {
  const terms = createEmptyTerms();
  const evidence: FieldEvidence[] = [];
  const sectionKey = `section:${section.chunkIndex}`;
  const text = section.content;

  const brand = parseNameAfterLabel(text, ["brand", "client"]);
  if (brand) {
    terms.brandName = brand.value;
    pushEvidence(evidence, "brandName", brand.snippet, sectionKey, 0.76);
  }

  const agency = parseNameAfterLabel(text, ["agency"]);
  if (agency) {
    terms.agencyName = agency.value;
    pushEvidence(evidence, "agencyName", agency.snippet, sectionKey, 0.72);
  }

  const creator = parseNameAfterLabel(text, ["creator", "talent", "influencer"]);
  if (creator) {
    terms.creatorName = creator.value;
    pushEvidence(evidence, "creatorName", creator.snippet, sectionKey, 0.74);
  }

  const campaign = parseNameAfterLabel(text, ["campaign", "project"]);
  if (campaign) {
    terms.campaignName = campaign.value;
    pushEvidence(evidence, "campaignName", campaign.snippet, sectionKey, 0.72);
  }

  if (isSectionRelevant(section, ["compensation", "payment", "invoice", "fee"])) {
    const amount = parseCurrencyAmount(text);
    if (amount) {
      terms.paymentAmount = amount.amount;
      terms.currency = amount.currency;
      pushEvidence(evidence, "paymentAmount", amount.snippet, sectionKey, 0.88);
    }

    const netTerms = parseNetTerms(text);
    if (netTerms) {
      terms.paymentTerms = netTerms.paymentTerms;
      terms.netTermsDays = netTerms.netTermsDays;
      pushEvidence(evidence, "paymentTerms", netTerms.snippet, sectionKey, 0.84);
    }

    const paymentStructure = parsePaymentStructure(text);
    if (paymentStructure) {
      terms.paymentStructure = paymentStructure.value;
      pushEvidence(evidence, "paymentStructure", paymentStructure.snippet, sectionKey, 0.8);
    }

    const paymentTrigger = parsePaymentTrigger(text);
    if (paymentTrigger) {
      terms.paymentTrigger = paymentTrigger.value;
      pushEvidence(evidence, "paymentTrigger", paymentTrigger.snippet, sectionKey, 0.8);
    }
  }

  if (
    isSectionRelevant(section, [
      "deliverables",
      "posting",
      "content requirements",
      "assets"
    ])
  ) {
    terms.deliverables = parseDeliverables(text, evidence);
  }

  if (isSectionRelevant(section, ["usage", "license", "paid", "whitelist"])) {
    if (/organic repost|organic usage|repost/i.test(text)) {
      terms.usageRightsOrganicAllowed = true;
    }
    if (/paid social|paid media|ads?|advertising/i.test(text)) {
      terms.usageRightsPaidAllowed = true;
    }
    if (/whitelist|whitelisting/i.test(text)) {
      terms.whitelistingAllowed = true;
    }

    const usageDuration = parseDuration(text, "(usage|license|rights)");
    if (usageDuration) {
      terms.usageDuration = usageDuration.value;
    }

    const territory = firstMatch(
      text,
      /\b(worldwide|global|united states|north america|europe|uk)\b/i
    );
    if (territory) {
      terms.usageTerritory = territory.value;
    }

    if (
      terms.usageRightsOrganicAllowed ||
      terms.usageRightsPaidAllowed ||
      terms.whitelistingAllowed
    ) {
      terms.usageRights = buildUsageRightsSummary(terms);
      pushEvidence(evidence, "usageRights", sentenceAround(text, 0), sectionKey, 0.72);
    }

    if (terms.usageRightsOrganicAllowed) {
      terms.usageChannels.push("Organic reposting");
    }
    if (terms.usageRightsPaidAllowed) {
      terms.usageChannels.push("Paid social");
    }
    if (terms.whitelistingAllowed) {
      terms.usageChannels.push("Whitelisting");
    }
  }

  if (isSectionRelevant(section, ["exclusive", "exclusivity", "competitive"])) {
    if (/exclusive|exclusivity/i.test(text)) {
      terms.exclusivityApplies = true;
      const duration = parseDuration(text, "exclusiv");
      if (duration) {
        terms.exclusivityDuration = duration.value;
      }

      const category = firstMatch(
        text,
        /(?:category|competing|competitive)\s+([A-Za-z0-9&'\'\- ]{3,60})/i
      );
      if (category) {
        terms.exclusivityCategory = category.value.trim();
      }

      terms.exclusivityRestrictions = sentenceAround(text, 0);
      terms.exclusivity = terms.exclusivityRestrictions;
      pushEvidence(evidence, "exclusivity", sentenceAround(text, 0), sectionKey, 0.74);
    }
  }

  const revisionInfo = parseRevisionRounds(text);
  if (revisionInfo) {
    terms.revisions = revisionInfo.revisions;
    terms.revisionRounds = revisionInfo.revisionRounds;
    pushEvidence(evidence, "revisions", revisionInfo.snippet, sectionKey, 0.72);
  }

  if (isSectionRelevant(section, ["termination", "cancel"])) {
    if (/terminat|cancel/i.test(text)) {
      terms.terminationAllowed = true;
      terms.termination = sentenceAround(text, 0);
      const notice = firstMatch(
        text,
        /(\d+\s*(?:day|days|week|weeks)|immediately|without notice)/i
      );
      if (notice) {
        terms.terminationNotice = notice.value;
      }

      terms.terminationConditions = sentenceAround(text, 0);
      pushEvidence(evidence, "termination", sentenceAround(text, 0), sectionKey, 0.7);
    }
  }

  const law = firstMatch(text, /governed by the laws of ([A-Za-z ]+)/i);
  if (law) {
    terms.governingLaw = law.value.trim();
    pushEvidence(evidence, "governingLaw", sentenceAround(text, law.index), sectionKey, 0.75);
  }

  if (documentKind === "email_thread") {
    terms.notes = "Imported from pasted email text. Confirm any negotiated changes manually.";
  }

  const intelligence = buildConflictIntelligencePatch({
    text,
    sectionKey,
    fallbackTerms: terms
  });

  const nextTerms = {
    ...terms,
    ...intelligence.patch
  };

  return {
    schemaVersion: "v2-section",
    model: "fallback-section",
    confidence: 0.68,
    data: nextTerms,
    evidence: [...evidence, ...intelligence.evidence],
    conflicts: []
  };
}

function dedupeEvidence(evidence: FieldEvidence[]) {
  const seen = new Set<string>();
  return evidence.filter((entry) => {
    const key = `${entry.fieldPath}:${entry.snippet}:${entry.sectionKey ?? "none"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sameScalarValue(left: unknown, right: unknown) {
  if (typeof left === "string" && typeof right === "string") {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }

  return left === right;
}

function mergeDeliverablesWithPriority(
  existing: ReturnType<typeof createEmptyTerms>["deliverables"],
  incoming: ReturnType<typeof createEmptyTerms>["deliverables"]
) {
  const merged = new Map<string, (typeof existing)[number]>();
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];

  for (const item of [...safeExisting, ...safeIncoming]) {
    merged.set(`${item.title}:${item.dueDate ?? "none"}`, item);
  }

  return Array.from(merged.values()).sort((left, right) =>
    (left.dueDate ?? "").localeCompare(right.dueDate ?? "")
  );
}

export function mergeExtractionResults(parts: ExtractionPipelineResult[]) {
  const merged = createEmptyTerms();
  const evidence: FieldEvidence[] = [];
  const conflicts = new Set<string>();
  const scalarKeys = Object.keys(merged).filter(
    (key) =>
      key !== "deliverables" &&
      key !== "usageChannels" &&
      key !== "competitorCategories" &&
      key !== "restrictedCategories" &&
      key !== "disclosureObligations" &&
      key !== "campaignDateWindow" &&
      key !== "pendingExtraction"
  ) as Array<keyof typeof merged>;

  for (const part of parts) {
    const partEvidence = Array.isArray(part.evidence) ? part.evidence : [];
    const partDeliverables = Array.isArray(part.data.deliverables) ? part.data.deliverables : [];
    const partUsageChannels = Array.isArray(part.data.usageChannels) ? part.data.usageChannels : [];

    evidence.push(...partEvidence);
    merged.deliverables = mergeDeliverablesWithPriority(
      merged.deliverables,
      partDeliverables
    );
    merged.usageChannels = Array.from(
      new Set([...merged.usageChannels, ...partUsageChannels])
    );

    for (const key of scalarKeys) {
      const candidate = (part.data as Record<string, unknown>)[key];
      const current = merged[key];

      if (candidate === null || candidate === undefined) {
        continue;
      }

      if (current === null || current === undefined) {
        merged[key] = candidate as never;
        continue;
      }

      if (!sameScalarValue(current, candidate)) {
        conflicts.add(String(key));
      }
    }
  }

  for (const key of scalarKeys) {
    const values = parts
      .map((part) => (part.data as Record<string, unknown>)[key])
      .filter((value) => value !== null && value !== undefined);

    if (values.length === 0) {
      continue;
    }

    merged[key] = values[0] as never;
  }

  const confidence =
    parts.length > 0
      ? Number(
          (
            parts.reduce((sum, part) => sum + (part.confidence ?? 0), 0) / parts.length
          ).toFixed(2)
        )
      : 0.68;

  return {
    schemaVersion: "v2-section-merge",
    model: parts.map((part) => part.model).filter(Boolean).join("+") || "fallback-merge",
    confidence,
    data: {
      ...merged,
      ...mergeConflictIntelligence(merged, {
        competitorCategories: parts.flatMap((part) =>
          Array.isArray(part.data.competitorCategories) ? part.data.competitorCategories : []
        ),
        restrictedCategories: parts.flatMap((part) =>
          Array.isArray(part.data.restrictedCategories) ? part.data.restrictedCategories : []
        ),
        disclosureObligations: parts.flatMap((part) =>
          Array.isArray(part.data.disclosureObligations) ? part.data.disclosureObligations : []
        ),
        campaignDateWindow:
          parts.find((part) => part.data.campaignDateWindow)?.data.campaignDateWindow ?? null
      })
    },
    evidence: dedupeEvidence(evidence),
    conflicts: Array.from(conflicts)
  };
}
