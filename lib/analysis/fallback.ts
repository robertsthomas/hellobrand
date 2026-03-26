import { randomUUID } from "node:crypto";

import {
  buildConflictIntelligencePatch,
  mergeConflictIntelligence
} from "@/lib/conflict-intelligence";
import type {
  BriefData,
  DealAggregate,
  DealTermsRecord,
  DeliverableItem,
  DocumentAnalysisResult,
  DocumentClassificationResult,
  DocumentKind,
  DocumentSectionInput,
  ExtractionPipelineResult,
  FieldEvidence,
  GeneratedBrief,
  GeneratedBriefSection,
  RiskFlagRecord
} from "@/lib/types";

function createEmptyTerms(): Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt"> {
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

function sentenceAround(text: string, index: number) {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  const nextPeriod = text.indexOf(".", index);
  const end = nextPeriod === -1 ? text.length : nextPeriod + 1;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function firstMatch(
  text: string,
  pattern: RegExp
): { value: string; index: number } | null {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) {
    return null;
  }

  return { value: match[1] ?? match[0], index: match.index };
}

function pushEvidence(
  evidence: FieldEvidence[],
  fieldPath: string,
  snippet: string | null,
  sectionKey: string | null,
  confidence = 0.7
) {
  if (!snippet) {
    return;
  }

  evidence.push({
    fieldPath,
    snippet,
    sectionKey,
    confidence
  });
}

function findSectionByKeyword(sections: DocumentSectionInput[], keywords: string[]) {
  return (
    sections.find((section) =>
      keywords.some((keyword) =>
        section.title.toLowerCase().includes(keyword) ||
        section.content.toLowerCase().includes(keyword)
      )
    ) ?? null
  );
}

function parseCurrencyAmount(text: string) {
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

function parseNetTerms(text: string) {
  const match = firstMatch(text, /\bnet\s?(\d{1,3})\b/i);
  if (!match) {
    return null;
  }

  return {
    paymentTerms: `Net ${match.value}`,
    netTermsDays: Number(match.value),
    snippet: sentenceAround(text, match.index)
  };
}

function parseDuration(text: string, keyword: string) {
  const match = firstMatch(
    text,
    new RegExp(
      `${keyword}[^.\\n]{0,120}?(\\d+\\s*(?:day|days|week|weeks|month|months|year|years)|perpetual)`,
      "i"
    )
  );

  if (!match) {
    return null;
  }

  return {
    value: match.value,
    snippet: sentenceAround(text, match.index)
  };
}

function parseNameAfterLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const match = firstMatch(
      text,
      new RegExp(`${label}\\s*:?\\s*([A-Z][A-Za-z0-9&'’\\- ]{2,80})`, "i")
    );
    if (match) {
      return {
        value: match.value.trim(),
        snippet: sentenceAround(text, match.index)
      };
    }
  }

  return null;
}

function parseRevisionRounds(text: string) {
  const numberMatch = firstMatch(text, /(\d+)\s+rounds?\s+of\s+revisions?/i);
  if (numberMatch) {
    return {
      revisions: `${numberMatch.value} rounds of revisions`,
      revisionRounds: Number(numberMatch.value),
      snippet: sentenceAround(text, numberMatch.index)
    };
  }

  const wordMatch = firstMatch(text, /(one|two)\s+rounds?\s+of\s+revisions?/i);
  if (!wordMatch) {
    return null;
  }

  const value = wordMatch.value.toLowerCase() === "one" ? 1 : 2;
  return {
    revisions: `${wordMatch.value} rounds of revisions`,
    revisionRounds: value,
    snippet: sentenceAround(text, wordMatch.index)
  };
}

function inferDateNear(text: string, startIndex: number) {
  const window = text.slice(Math.max(0, startIndex - 120), startIndex + 240);
  const match = window.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?/i
  );

  if (!match) {
    return null;
  }

  const candidate = new Date(match[0]);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate.toISOString();
}

function parseDeliverables(text: string, evidence: FieldEvidence[]) {
  const deliverables: Omit<
    DealTermsRecord,
    "id" | "dealId" | "createdAt" | "updatedAt"
  >["deliverables"] = [];
  const patterns = [
    {
      pattern: /(\d+)\s+instagram\s+(post|story|stories|reel|reels)/gi,
      channel: "Instagram"
    },
    {
      pattern: /(\d+)\s+tiktok\s+(video|videos|post|posts|reel|reels)/gi,
      channel: "TikTok"
    },
    {
      pattern: /(\d+)\s+youtube\s+(integration|video|videos|short|shorts)/gi,
      channel: "YouTube"
    }
  ];

  for (const { pattern, channel } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const quantity = Number(match[1]);
      const title = `${channel} ${match[2]}`.replace(/\b\w/g, (value) =>
        value.toUpperCase()
      );
      const index = match.index ?? 0;
      const dueDate = inferDateNear(text, index);

      deliverables.push({
        id: randomUUID(),
        title,
        dueDate,
        channel,
        quantity,
        status: "pending" as const,
        description: null
      });

      pushEvidence(
        evidence,
        "deliverables",
        sentenceAround(text, index),
        null,
        0.82
      );
    }
  }

  return deliverables;
}

function getTopDocumentLines(text: string, count = 6) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

function isBriefLikeDocumentKind(documentKind: DocumentKind) {
  return (
    documentKind === "campaign_brief" ||
    documentKind === "deliverables_brief" ||
    documentKind === "pitch_deck"
  );
}

function isGenericCampaignName(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  return /^(concept|campaign concept|brief|overview)$/i.test(value.trim());
}

function inferBriefBrandName(text: string) {
  const [firstLine] = getTopDocumentLines(text, 1);
  if (!firstLine) {
    return null;
  }

  const candidate = firstLine
    .replace(/\b(influencer|campaign|creative|content)\s+brief\b/gi, "")
    .replace(/\bbrief\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return candidate.length > 1 ? candidate : null;
}

function shouldUseInferredBriefBrandName(
  currentBrandName: string | null | undefined,
  inferredBrandName: string | null | undefined
) {
  if (!inferredBrandName) {
    return false;
  }

  if (!currentBrandName) {
    return true;
  }

  const current = currentBrandName.trim().toLowerCase();
  const inferredTokens = inferredBrandName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (
    /hook|second|requirement|guideline|messaging|concept/.test(current) ||
    current.length > 40
  ) {
    return true;
  }

  return !inferredTokens.some((token) => current.includes(token));
}

function inferBriefCampaignName(text: string, fileName?: string | null) {
  const topLines = getTopDocumentLines(text, 4);

  for (const line of topLines.slice(1)) {
    if (
      line.length > 2 &&
      line.length < 100 &&
      !/^(overview|key messaging|creative territories|creative requirements|required elements)$/i.test(
        line
      )
    ) {
      return line;
    }
  }

  if (!fileName) {
    return null;
  }

  const stem = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const afterBrief = stem.match(/\bbrief\b\s+(.+)$/i)?.[1]?.trim();
  return afterBrief?.length ? afterBrief : null;
}

function parseBriefDeliverables(text: string, evidence: FieldEvidence[]) {
  const deliverables: DeliverableItem[] = [];
  const seen = new Set<string>();
  const patterns = [
    {
      pattern: /\big\s+reel\s+or\s+tiktok\b/i,
      title: "IG Reel or TikTok",
      channel: "Instagram/TikTok"
    },
    {
      pattern: /\b(?:ig|instagram)\s+story\b/i,
      title: "IG Story",
      channel: "Instagram"
    },
    {
      pattern: /\b(?:tiktok|tik tok)\b/i,
      title: "TikTok",
      channel: "TikTok"
    }
  ];

  for (const { pattern, title, channel } of patterns) {
    const match = pattern.exec(text);
    if (!match || seen.has(title)) {
      continue;
    }

    const index = match.index ?? 0;
    deliverables.push({
      id: randomUUID(),
      title,
      dueDate: null,
      channel,
      quantity: 1,
      status: "pending",
      description: sentenceAround(text, index)
    });
    seen.add(title);
    pushEvidence(
      evidence,
      "deliverables",
      sentenceAround(text, index),
      null,
      0.72
    );
  }

  return deliverables;
}

function inferSectionTitle(content: string, kind: DocumentKind) {
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

function isSectionRelevant(section: DocumentSectionInput, keywords: string[]) {
  const lowerTitle = section.title.toLowerCase();
  const lowerContent = section.content.toLowerCase();

  return keywords.some(
    (keyword) => lowerTitle.includes(keyword) || lowerContent.includes(keyword)
  );
}

export function classifyDocumentHeuristically(
  text: string,
  fileName = ""
): DocumentClassificationResult {
  const lower = `${fileName}\n${text}`.toLowerCase();

  if (
    /governing law|indemnif|term and termination|compensation|brand shall pay|creator agreement|agreement/.test(
      lower
    )
  ) {
    return { documentKind: "contract", confidence: 0.95 };
  }

  if (/invoice|amount due|invoice number|bill to/.test(lower)) {
    return { documentKind: "invoice", confidence: 0.92 };
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
      /^[A-Z0-9][A-Za-z0-9/&'’(),\- ]+$/.test(firstLine)
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

function extractStructuredTermsFromSection(
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

    if (/flat fee|one-time fee/i.test(text)) {
      terms.paymentStructure = "Flat fee";
    }

    if (/after invoice|upon receipt of invoice/i.test(text)) {
      terms.paymentTrigger = "After invoice receipt";
    } else if (/upon posting|after posting/i.test(text)) {
      terms.paymentTrigger = "After posting";
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
        /(?:category|competing|competitive)\s+([A-Za-z0-9&'’\- ]{3,60})/i
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

    const preferred = values[0];
    merged[key] = preferred as never;
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

function buildUsageRightsSummary(terms: ReturnType<typeof createEmptyTerms>) {
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

export function analyzeCreatorRisks(
  text: string,
  documentId: string,
  extraction: ReturnType<typeof extractStructuredTerms>
) {
  const risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">> = [];
  const lower = text.toLowerCase();
  const deliverables = Array.isArray(extraction.data.deliverables)
    ? extraction.data.deliverables
    : [];

  if ((extraction.data.netTermsDays ?? 0) >= 45) {
    risks.push({
      category: "payment_terms",
      title: "Long payment window",
      detail:
        "The contract appears to delay payment longer than many creator deals.",
      severity: "medium",
      suggestedAction: "Ask whether payment can be shortened to Net 15 or Net 30.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "paymentTerms")
        .map((entry) => entry.snippet),
      sourceDocumentId: documentId
    });
  }

  if (/perpetual/.test(lower)) {
    risks.push({
      category: "usage_rights",
      title: "Perpetual usage rights",
      detail:
        "The brand appears to receive unlimited-duration rights to use your content or likeness.",
      severity: "high",
      suggestedAction: "Limit usage to a fixed term and define where it can run.",
      evidence: [sentenceAround(text, lower.indexOf("perpetual"))],
      sourceDocumentId: documentId
    });
  }

  if (extraction.data.usageRightsPaidAllowed) {
    risks.push({
      category: "usage_rights",
      title: "Paid usage included",
      detail:
        "The agreement appears to allow paid usage or ad rights without clearly separated compensation.",
      severity: "high",
      suggestedAction:
        "Confirm channels, duration, and added compensation for paid usage.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "usageRights")
        .map((entry) => entry.snippet),
      sourceDocumentId: documentId
    });
  }

  if ((extraction.data.exclusivityApplies ?? false) && extraction.data.exclusivityDuration) {
    risks.push({
      category: "exclusivity",
      title: "Exclusivity restrictions present",
      detail:
        "The deal appears to limit competitive partnerships, which may block future paid work.",
      severity: "medium",
      suggestedAction: "Reduce the category scope or shorten the exclusivity period.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "exclusivity")
        .map((entry) => entry.snippet),
      sourceDocumentId: documentId
    });
  }

  if (deliverables.length === 0 || /to be agreed|as requested|tbd/i.test(lower)) {
    risks.push({
      category: "deliverables",
      title: "Deliverables may be vague",
      detail:
        "The exact content requirements may be too open-ended for a smooth campaign workflow.",
      severity: "medium",
      suggestedAction: "Ask for a defined list of assets, platforms, and approval rounds.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "deliverables")
        .map((entry) => entry.snippet)
        .slice(0, 1),
      sourceDocumentId: documentId
    });
  }

  if (/sole discretion|without cause|terminate immediately/i.test(lower)) {
    risks.push({
      category: "termination",
      title: "One-sided termination language",
      detail:
        "The brand may be able to cancel more easily than the creator, which can put compensation at risk.",
      severity: "medium",
      suggestedAction:
        "Request notice requirements and protection for work already completed.",
      evidence: [sentenceAround(text, Math.max(lower.indexOf("terminate"), 0))],
      sourceDocumentId: documentId
    });
  }

  if (risks.length === 0) {
    risks.push({
      category: "other",
      title: "Manual review still recommended",
      detail:
        "No major creator-specific watchouts were confidently detected, but you should still confirm scope, timing, and usage before signing.",
      severity: "low",
      suggestedAction: "Double-check deliverables, payment timing, and rights granted.",
      evidence: [],
      sourceDocumentId: documentId
    });
  }

  return risks;
}

export function buildCreatorSummary(
  extraction: ReturnType<typeof extractStructuredTerms>,
  risks: ReturnType<typeof analyzeCreatorRisks>
) {
  const deliverables = Array.isArray(extraction.data.deliverables)
    ? extraction.data.deliverables
    : [];
  const amount =
    extraction.data.paymentAmount !== null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: extraction.data.currency ?? "USD",
          maximumFractionDigits: 0
        }).format(extraction.data.paymentAmount)
      : "an unspecified amount";

  const deliverableLine =
    deliverables.length > 0
      ? deliverables
          .map((item) =>
            item.quantity ? `${item.quantity} ${item.title}` : item.title
          )
          .join(", ")
      : "deliverables that still need manual review";

  const rightsLine =
    extraction.data.usageRights ??
    "usage rights that still need to be clarified from the document";

  const topRisk = risks[0];

  if (extraction.data.briefData) {
    const brandOrCampaign = [extraction.data.brandName, extraction.data.campaignName]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" • ");
    const keyPoints = [
      ...extraction.data.briefData.messagingPoints,
      ...extraction.data.briefData.talkingPoints
    ].slice(0, 2);
    const overview =
      extraction.data.briefData.campaignOverview ??
      extraction.data.briefData.creativeConceptOverview;
    const deliverableLine =
      deliverables.length > 0
        ? deliverables
            .map((item) =>
              item.quantity && item.quantity > 1
                ? `${item.quantity} ${item.title}`
                : item.title
            )
            .join(", ")
        : "creator content requirements that still need manual confirmation";

    return {
      body: [
        brandOrCampaign
          ? `This brief is for ${brandOrCampaign}.`
          : "This document reads like a creator brief.",
        overview ? overview : `It calls for ${deliverableLine}.`,
        keyPoints.length > 0 ? `Key messaging includes ${keyPoints.join(" and ")}.` : null,
        topRisk ? `Main watchout: ${topRisk.title.toLowerCase()}.` : null
      ]
        .filter((value): value is string => Boolean(value))
        .join(" "),
      version: "v1"
    };
  }

  return {
    body: `This deal appears to cover ${deliverableLine} for ${amount}. Payment terms are ${extraction.data.paymentTerms ?? "not clearly stated"}, and the brand receives ${rightsLine}. The main watchout right now is ${topRisk.title.toLowerCase()}.`,
    version: "v1"
  };
}

export function extractBriefData(text: string, documentKind: DocumentKind): BriefData | null {
  if (
    documentKind !== "campaign_brief" &&
    documentKind !== "deliverables_brief" &&
    documentKind !== "pitch_deck"
  ) {
    return null;
  }

  const lower = text.toLowerCase();

  function extractAfterLabel(patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
    return null;
  }

  function extractListAfterLabel(patterns: RegExp[]): string[] {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1]
          .split(/\n|;|•|–|—|-\s/)
          .map((item) => item.replace(/^\d+\.\s*/, "").trim())
          .filter((item) => item.length > 2);
      }
    }
    return [];
  }

  const campaignOverview = extractAfterLabel([
    /(?:campaign overview|overview)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i,
    /(?:concept|creative concept)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const messagingPoints = extractListAfterLabel([
    /(?:key messaging|messaging points?|key messages)[:\s]*\n?([\s\S]{10,800}?)(?:\n\n|\n[A-Z])/i
  ]);

  const talkingPoints = extractListAfterLabel([
    /(?:talking points?|key talking)[:\s]*\n?([\s\S]{10,800}?)(?:\n\n|\n[A-Z])/i
  ]);

  const creativeConceptOverview = extractAfterLabel([
    /(?:creative concept|concept overview)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const brandGuidelines = extractAfterLabel([
    /(?:brand guidelines?|style guide)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const approvalRequirements = extractAfterLabel([
    /(?:approval (?:process|requirements?|workflow))[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const targetAudience = extractAfterLabel([
    /(?:target audience|audience)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const toneAndStyle = extractAfterLabel([
    /(?:tone (?:and|&) style|tone|voice)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const doNotMention = extractListAfterLabel([
    /(?:do not mention|avoid|don't mention|do not include)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const hasContent =
    campaignOverview ||
    messagingPoints.length > 0 ||
    talkingPoints.length > 0 ||
    creativeConceptOverview ||
    brandGuidelines ||
    approvalRequirements ||
    targetAudience ||
    toneAndStyle ||
    doNotMention.length > 0;

  if (!hasContent) {
    return null;
  }

  return {
    campaignOverview,
    messagingPoints,
    talkingPoints,
    creativeConceptOverview,
    brandGuidelines,
    approvalRequirements,
    targetAudience,
    toneAndStyle,
    doNotMention,
    sourceDocumentIds: []
  };
}

export function fallbackAnalyzeDocument(
  text: string,
  options?: { fileName?: string; documentKindHint?: DocumentKind | null }
): DocumentAnalysisResult {
  const classification =
    options?.documentKindHint && options.documentKindHint !== "unknown"
      ? { documentKind: options.documentKindHint, confidence: 1 }
      : classifyDocumentHeuristically(text, options?.fileName);
  const sections = splitIntoSections(text, classification.documentKind);
  const extraction = extractStructuredTerms(text, sections, classification.documentKind);

  if (isBriefLikeDocumentKind(classification.documentKind)) {
    const briefData = extractBriefData(text, classification.documentKind);
    if (briefData) {
      extraction.data.briefData = briefData;
    }

    const inferredBrandName = inferBriefBrandName(text);
    if (shouldUseInferredBriefBrandName(extraction.data.brandName, inferredBrandName)) {
      extraction.data.brandName = inferredBrandName;
    }

    if (isGenericCampaignName(extraction.data.campaignName)) {
      extraction.data.campaignName =
        inferBriefCampaignName(text, options?.fileName) ?? extraction.data.campaignName;
    }

    if ((extraction.data.deliverables?.length ?? 0) === 0) {
      extraction.data.deliverables = parseBriefDeliverables(text, extraction.evidence);
    }
  }

  const riskFlags = analyzeCreatorRisks(text, "pending-document", extraction);
  const summary = buildCreatorSummary(extraction, riskFlags);

  return {
    classification,
    sections,
    extraction,
    riskFlags,
    summary
  };
}

export function fallbackAnalyzeContract(text: string) {
  const result = fallbackAnalyzeDocument(text, {
    fileName: "contract.txt",
    documentKindHint: "contract"
  });

  return {
    summary: result.summary.body,
    terms: result.extraction.data,
    riskFlags: result.riskFlags
  };
}

export function buildFallbackBrief(aggregate: DealAggregate): GeneratedBrief {
  const { deal, terms, riskFlags } = aggregate;
  const briefData = terms?.briefData;
  const deliverables = terms?.deliverables ?? [];
  const sections: GeneratedBriefSection[] = [];

  const overview =
    briefData?.campaignOverview ??
    aggregate.currentSummary?.body ??
    deal.summary;
  if (overview) {
    sections.push({
      id: "campaign-overview",
      title: "Campaign Overview",
      content: overview
    });
  }

  if (deliverables.length > 0) {
    sections.push({
      id: "deliverables-summary",
      title: "Deliverables Summary",
      content: `This campaign includes ${deliverables.length} deliverable${deliverables.length === 1 ? "" : "s"}.`,
      items: deliverables.map((d) => {
        const parts = [d.title];
        if (d.channel) parts.push(`(${d.channel})`);
        if (d.dueDate) parts.push(`due ${d.dueDate}`);
        return parts.join(" ");
      })
    });
  }

  const dateWindow = terms?.campaignDateWindow;
  const dueDates = deliverables.filter((d) => d.dueDate).map((d) => d.dueDate!);
  if (dateWindow || dueDates.length > 0) {
    const items: string[] = [];
    if (dateWindow?.startDate) items.push(`Campaign start: ${dateWindow.startDate}`);
    if (dateWindow?.endDate) items.push(`Campaign end: ${dateWindow.endDate}`);
    if (dateWindow?.postingWindow) items.push(`Posting window: ${dateWindow.postingWindow}`);
    for (const d of deliverables) {
      if (d.dueDate) items.push(`${d.title}: ${d.dueDate}`);
    }
    sections.push({
      id: "key-dates",
      title: "Key Dates",
      content: "Important dates for this campaign.",
      items
    });
  }

  if (briefData?.talkingPoints && briefData.talkingPoints.length > 0) {
    sections.push({
      id: "talking-points",
      title: "Talking Points",
      content: "Key points to cover in your content.",
      items: briefData.talkingPoints
    });
  }

  if (briefData?.messagingPoints && briefData.messagingPoints.length > 0) {
    sections.push({
      id: "messaging-guidelines",
      title: "Messaging Guidelines",
      content: "Core messaging to weave into your content.",
      items: briefData.messagingPoints
    });
  }

  if (briefData?.brandGuidelines) {
    sections.push({
      id: "brand-guidelines",
      title: "Brand Guidelines",
      content: briefData.brandGuidelines
    });
  }

  const usageParts: string[] = [];
  if (terms?.usageRights) usageParts.push(terms.usageRights);
  if (terms?.usageDuration) usageParts.push(`Duration: ${terms.usageDuration}`);
  if (terms?.usageChannels && terms.usageChannels.length > 0) {
    usageParts.push(`Channels: ${terms.usageChannels.join(", ")}`);
  }
  if (usageParts.length > 0) {
    sections.push({
      id: "usage-rights-summary",
      title: "Usage Rights Summary",
      content: usageParts.join(". ") + "."
    });
  }

  if (briefData?.doNotMention && briefData.doNotMention.length > 0) {
    sections.push({
      id: "do-not-mention",
      title: "Do Not Mention",
      content: "Avoid the following topics or references in your content.",
      items: briefData.doNotMention
    });
  }

  if (briefData?.approvalRequirements) {
    sections.push({
      id: "approval-requirements",
      title: "Approval Requirements",
      content: briefData.approvalRequirements
    });
  }

  return {
    sections,
    generatedAt: new Date().toISOString(),
    modelVersion: "fallback"
  };
}
