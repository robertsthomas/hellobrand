import type {
  CampaignDateWindow,
  ConflictResult,
  DealAggregate,
  DealCategory,
  DealTermsRecord,
  DisclosureObligation,
  FieldEvidence
} from "@/lib/types";

type TermsData = Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">;

const CATEGORY_KEYWORDS: Record<DealCategory, string[]> = {
  beauty_personal_care: [
    "beauty",
    "skincare",
    "skin care",
    "makeup",
    "cosmetic",
    "haircare",
    "hair care",
    "personal care",
    "fragrance",
    "wellness beauty",
    "sephora",
    "ulta"
  ],
  fashion_apparel: [
    "fashion",
    "apparel",
    "clothing",
    "wardrobe",
    "denim",
    "handbag",
    "accessories",
    "shoe",
    "footwear",
    "style",
    "streetwear"
  ],
  food_beverage: [
    "food",
    "beverage",
    "drink",
    "snack",
    "meal",
    "restaurant",
    "coffee",
    "grocery",
    "protein bar",
    "lunchables",
    "cpg"
  ],
  entertainment_media: [
    "movie",
    "streaming",
    "series",
    "show",
    "film",
    "trailer",
    "episode",
    "netflix",
    "hulu",
    "disney+",
    "prime video"
  ],
  fitness_wellness: [
    "fitness",
    "wellness",
    "supplement",
    "gym",
    "workout",
    "recovery",
    "pilates",
    "nutrition",
    "running"
  ],
  parenting_family: [
    "parenting",
    "family",
    "baby",
    "toddler",
    "kids",
    "children",
    "mom",
    "maternal"
  ],
  tech_gaming: [
    "tech",
    "gaming",
    "software",
    "app",
    "mobile game",
    "console",
    "pc",
    "laptop",
    "phone",
    "creator tool"
  ],
  travel_hospitality: [
    "travel",
    "hotel",
    "airline",
    "resort",
    "tourism",
    "vacation",
    "destination",
    "booking"
  ],
  finance: [
    "finance",
    "bank",
    "credit card",
    "insurance",
    "investment",
    "fintech",
    "tax",
    "crypto"
  ],
  home_lifestyle: [
    "home",
    "furniture",
    "decor",
    "kitchen",
    "appliance",
    "mattress",
    "cleaning",
    "lifestyle"
  ],
  retail_ecommerce: [
    "retail",
    "ecommerce",
    "marketplace",
    "shopping",
    "subscription box",
    "storewide",
    "shop now"
  ],
  sports_outdoors: [
    "sports",
    "outdoors",
    "athletic",
    "trail",
    "camping",
    "hiking",
    "cycling",
    "golf",
    "pickleball"
  ],
  other: []
};

const CATEGORY_LABELS: Record<DealCategory, string> = {
  beauty_personal_care: "Beauty & personal care",
  fashion_apparel: "Fashion & apparel",
  food_beverage: "Food & beverage",
  entertainment_media: "Entertainment & media",
  fitness_wellness: "Fitness & wellness",
  parenting_family: "Parenting & family",
  tech_gaming: "Tech & gaming",
  travel_hospitality: "Travel & hospitality",
  finance: "Finance",
  home_lifestyle: "Home & lifestyle",
  retail_ecommerce: "Retail & ecommerce",
  sports_outdoors: "Sports & outdoors",
  other: "Other"
};

const KNOWN_BRAND_CATEGORY_HINTS: Array<{
  match: RegExp;
  brand: string;
  category: DealCategory;
}> = [
  { match: /\bnetflix\b/i, brand: "Netflix", category: "entertainment_media" },
  { match: /\bhulu\b/i, brand: "Hulu", category: "entertainment_media" },
  { match: /\bdisney\+?\b/i, brand: "Disney+", category: "entertainment_media" },
  { match: /\bprime video\b/i, brand: "Prime Video", category: "entertainment_media" },
  { match: /\blunchables\b/i, brand: "Lunchables", category: "food_beverage" },
  { match: /\boreo\b/i, brand: "Oreo", category: "food_beverage" },
  { match: /\bcakesters\b/i, brand: "Oreo Cakesters", category: "food_beverage" },
  { match: /\bchips ahoy\b/i, brand: "Chips Ahoy", category: "food_beverage" },
  { match: /\bgoldfish\b/i, brand: "Goldfish", category: "food_beverage" },
  { match: /\bsephora\b/i, brand: "Sephora", category: "beauty_personal_care" },
  { match: /\bulta\b/i, brand: "Ulta", category: "beauty_personal_care" }
];

function normalizeWhitespace(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sentenceAround(text: string, index: number) {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  const nextPeriod = text.indexOf(".", index);
  const end = nextPeriod === -1 ? text.length : nextPeriod + 1;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function pushEvidence(
  evidence: FieldEvidence[],
  fieldPath: string,
  snippet: string | null,
  sectionKey: string | null,
  confidence: number
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

function parseDate(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const normalized = input.trim();
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const match = normalized.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?/i
  );
  if (!match) {
    return null;
  }

  const candidate = new Date(match[0]);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function formatIsoDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toISOString();
}

function compareDates(left: string | null, right: string | null) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }

  return left.localeCompare(right);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeWhitespace(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function detectKnownBrandCategory(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  for (const entry of KNOWN_BRAND_CATEGORY_HINTS) {
    if (entry.match.test(normalized)) {
      return entry;
    }
  }

  return null;
}

function scoreCategory(text: string, category: DealCategory) {
  const lower = text.toLowerCase();
  return CATEGORY_KEYWORDS[category].reduce((score, keyword) => {
    if (lower.includes(keyword)) {
      return score + Math.max(1, keyword.split(" ").length);
    }
    return score;
  }, 0);
}

export function dealCategoryLabel(category: DealCategory | null | undefined) {
  return category ? CATEGORY_LABELS[category] : null;
}

export function normalizeDealCategory(value: string | null | undefined): DealCategory | null {
  const normalized = normalizeWhitespace(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  for (const category of Object.keys(CATEGORY_KEYWORDS) as DealCategory[]) {
    if (category === "other") {
      continue;
    }

    if (scoreCategory(normalized, category) > 0) {
      return category;
    }
  }

  return null;
}

export function inferDealCategoryFromLabels(
  values: Array<string | null | undefined>
): DealCategory | null {
  const combined = uniqueStrings(values).join("\n");
  if (!combined) {
    return null;
  }

  let bestCategory: DealCategory | null = null;
  let bestScore = 0;

  for (const category of Object.keys(CATEGORY_KEYWORDS) as DealCategory[]) {
    if (category === "other") {
      continue;
    }

    const score = scoreCategory(combined, category);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

function chooseBrandCategory(
  texts: string[],
  fallbacks: Array<string | null | undefined>
): { category: DealCategory | null; confidence: number; snippet: string | null } {
  const brandHint = detectKnownBrandCategory(fallbacks[0] ?? null);
  const combined = uniqueStrings([...fallbacks, ...texts]).join("\n");
  if (!combined && !brandHint) {
    return { category: null, confidence: 0, snippet: null };
  }

  let bestCategory: DealCategory | null = null;
  let bestScore = 0;

  for (const category of Object.keys(CATEGORY_KEYWORDS) as DealCategory[]) {
    if (category === "other") {
      continue;
    }

    const score = scoreCategory(combined, category);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  if (brandHint && (!bestCategory || bestCategory !== brandHint.category)) {
    return {
      category: brandHint.category,
      confidence: bestCategory && bestCategory !== brandHint.category ? 0.98 : 0.95,
      snippet:
        bestCategory && bestCategory !== brandHint.category
          ? `${brandHint.brand} is a known ${CATEGORY_LABELS[brandHint.category]} brand, which overrides conflicting category language in the source.`
          : `${brandHint.brand} is a known ${CATEGORY_LABELS[brandHint.category]} brand.`
    };
  }

  if (!bestCategory) {
    return { category: null, confidence: 0, snippet: null };
  }

  const lower = combined.toLowerCase();
  const keyword = CATEGORY_KEYWORDS[bestCategory].find((entry) => lower.includes(entry)) ?? null;
  const snippet =
    keyword && lower.includes(keyword)
      ? sentenceAround(combined, lower.indexOf(keyword))
      : normalizeWhitespace(combined.slice(0, 180));

  return {
    category: bestCategory,
    confidence: Number(Math.min(0.95, 0.45 + bestScore * 0.08).toFixed(2)),
    snippet
  };
}

function extractRestrictionPhrases(text: string) {
  const results: string[] = [];
  const patterns = [
    /no\s+(?:other\s+)?(?:competitive|competing)\s+([a-z0-9&/' -]{3,80})/gi,
    /exclusive(?:ly)?\s+within\s+([a-z0-9&/' -]{3,80})/gi,
    /(?:category|vertical)\s+exclusivity(?:\s+for|\s+within)?\s+([a-z0-9&/' -]{3,80})/gi,
    /restricted\s+from\s+working\s+with\s+([a-z0-9&/' -]{3,80})/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const phrase = normalizeWhitespace(match[1]);
      if (phrase) {
        results.push(phrase);
      }
    }
  }

  return uniqueStrings(results);
}

function normalizeCategoryLabels(values: string[]) {
  const labels = values.flatMap((value) => {
    const normalized = normalizeDealCategory(value);
    if (!normalized) {
      return [];
    }

    return [CATEGORY_LABELS[normalized]];
  });

  return uniqueStrings(labels);
}

function extractDisclosureObligationsFromText(
  text: string,
  sectionKey: string | null
): {
  obligations: DisclosureObligation[];
  evidence: FieldEvidence[];
} {
  const lower = text.toLowerCase();
  const evidence: FieldEvidence[] = [];
  const obligations: DisclosureObligation[] = [];

  const entries = [
    {
      field: "disclosureObligations",
      pattern: /\b(#ad|#sponsored|paid partnership|disclose|disclosure)\b/i,
      title: "Disclosure required",
      detail:
        "This deal appears to require sponsored-content disclosure such as #ad, #sponsored, or a paid partnership label."
    },
    {
      field: "disclosureObligations",
      pattern: /\b(ftc|advertising standards|endorsement guidelines)\b/i,
      title: "Compliance requirement",
      detail:
        "This deal references compliance or endorsement guidance. Confirm the final post includes the required disclosure language."
    },
    {
      field: "disclosureObligations",
      pattern: /\b(pre-approval|approval required|must be approved|brand approval)\b/i,
      title: "Approval required",
      detail:
        "Content appears to require brand or agency approval before posting."
    }
  ];

  for (const entry of entries) {
    const match = lower.match(entry.pattern);
    if (!match || match.index === undefined) {
      continue;
    }

    const snippet = sentenceAround(text, match.index);
    pushEvidence(evidence, entry.field, snippet, sectionKey, 0.84);
    obligations.push({
      id: `${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${obligations.length + 1}`,
      title: entry.title,
      detail: entry.detail,
      source: snippet
    });
  }

  return {
    obligations,
    evidence
  };
}

function campaignDateWindowFromTerms(terms: TermsData) {
  const dates = uniqueStrings(
    terms.deliverables.map((item) => item.dueDate).concat(
      terms.campaignDateWindow?.startDate,
      terms.campaignDateWindow?.endDate
    )
  )
    .map((value) => parseDate(value))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => left.getTime() - right.getTime());

  if (dates.length === 0) {
    return terms.campaignDateWindow ?? null;
  }

  const startDate = formatIsoDate(dates[0]);
  const endDate = formatIsoDate(dates[dates.length - 1]);

  return {
    startDate,
    endDate,
    postingWindow:
      startDate && endDate && startDate !== endDate
        ? `${startDate.slice(0, 10)} to ${endDate.slice(0, 10)}`
        : startDate?.slice(0, 10) ?? endDate?.slice(0, 10) ?? null
  } satisfies CampaignDateWindow;
}

export function buildConflictIntelligencePatch(args: {
  text: string;
  sectionKey?: string | null;
  fallbackTerms: TermsData;
}) {
  const { text, fallbackTerms, sectionKey = null } = args;
  const evidence: FieldEvidence[] = [];
  const categoryChoice = chooseBrandCategory(text ? [text] : [], [
    fallbackTerms.brandName,
    fallbackTerms.campaignName,
    fallbackTerms.exclusivityCategory,
    fallbackTerms.exclusivityRestrictions
  ]);

  if (categoryChoice.snippet) {
    pushEvidence(
      evidence,
      "brandCategory",
      categoryChoice.snippet,
      sectionKey,
      categoryChoice.confidence || 0.7
    );
  }

  const restrictionPhrases = extractRestrictionPhrases(text);
  const normalizedRestrictionLabels = normalizeCategoryLabels([
    ...restrictionPhrases,
    fallbackTerms.exclusivityCategory ?? "",
    fallbackTerms.exclusivityRestrictions ?? ""
  ]);

  if (normalizedRestrictionLabels.length > 0) {
    const snippet = restrictionPhrases[0] ?? fallbackTerms.exclusivityRestrictions ?? null;
    pushEvidence(evidence, "restrictedCategories", snippet, sectionKey, 0.8);
    pushEvidence(evidence, "competitorCategories", snippet, sectionKey, 0.78);
  }

  const disclosure = extractDisclosureObligationsFromText(text, sectionKey);
  evidence.push(...disclosure.evidence);

  const campaignDateWindow = campaignDateWindowFromTerms(fallbackTerms);
  if (campaignDateWindow?.postingWindow) {
    pushEvidence(
      evidence,
      "campaignDateWindow",
      campaignDateWindow.postingWindow,
      sectionKey,
      0.72
    );
  }

  return {
    patch: {
      brandCategory: categoryChoice.category ?? fallbackTerms.brandCategory ?? null,
      competitorCategories:
        normalizedRestrictionLabels.length > 0
          ? normalizedRestrictionLabels
          : fallbackTerms.competitorCategories,
      restrictedCategories:
        normalizedRestrictionLabels.length > 0
          ? normalizedRestrictionLabels
          : fallbackTerms.restrictedCategories,
      campaignDateWindow,
      disclosureObligations:
        disclosure.obligations.length > 0
          ? disclosure.obligations
          : fallbackTerms.disclosureObligations
    },
    evidence
  };
}

function getDateWindow(aggregate: DealAggregate) {
  const termsWindow = aggregate.terms?.campaignDateWindow ?? null;
  if (termsWindow?.startDate || termsWindow?.endDate) {
    return termsWindow;
  }

  if (!aggregate.terms) {
    return null;
  }

  return campaignDateWindowFromTerms(aggregate.terms);
}

function windowsOverlap(left: CampaignDateWindow | null, right: CampaignDateWindow | null) {
  if (!left || !right) {
    return false;
  }

  const leftStart = parseDate(left.startDate);
  const leftEnd = parseDate(left.endDate ?? left.startDate);
  const rightStart = parseDate(right.startDate);
  const rightEnd = parseDate(right.endDate ?? right.startDate);

  if (!leftStart || !leftEnd || !rightStart || !rightEnd) {
    return false;
  }

  return leftStart.getTime() <= rightEnd.getTime() && rightStart.getTime() <= leftEnd.getTime();
}

function withinDays(left: CampaignDateWindow | null, right: CampaignDateWindow | null, days: number) {
  if (!left || !right) {
    return false;
  }

  const leftDate = parseDate(left.startDate ?? left.endDate);
  const rightDate = parseDate(right.startDate ?? right.endDate);
  if (!leftDate || !rightDate) {
    return false;
  }

  return Math.abs(leftDate.getTime() - rightDate.getTime()) <= days * 24 * 60 * 60 * 1000;
}

function activeDealForConflicts(aggregate: DealAggregate) {
  return Boolean(aggregate.deal.confirmedAt) && aggregate.deal.status !== "completed";
}

function categoryMatches(aggregate: DealAggregate, labels: string[]) {
  const category = aggregate.terms?.brandCategory ?? null;
  if (!category) {
    return false;
  }

  const label = CATEGORY_LABELS[category];
  return labels.includes(label);
}

export function buildConflictResults(
  target: DealAggregate,
  others: DealAggregate[]
): ConflictResult[] {
  const targetTerms = target.terms;
  if (!targetTerms || (target.deal.confirmedAt && target.deal.status === "completed")) {
    return [];
  }

  const results: ConflictResult[] = [];
  const targetWindow = getDateWindow(target);
  const targetCategory = targetTerms.brandCategory;
  const targetRestrictedCategories = targetTerms.restrictedCategories ?? [];

  for (const other of others) {
    if (other.deal.id === target.deal.id || !activeDealForConflicts(other) || !other.terms) {
      continue;
    }

    const otherTerms = other.terms;
    const otherCategory = otherTerms.brandCategory;
    const otherWindow = getDateWindow(other);
    const otherRestrictedCategories = otherTerms.restrictedCategories ?? [];

    if (targetCategory && otherCategory && targetCategory === otherCategory) {
      results.push({
        type: "category_conflict",
        level: "warning",
        severity: "medium",
        confidence: 0.79,
        title: `Similar category to ${other.deal.brandName}`,
        detail: `Both deals appear to sit in ${dealCategoryLabel(targetCategory)}. Review whether category overlap or exclusivity language creates risk before moving forward.`,
        relatedDealIds: [other.deal.id],
        evidenceRefs: [dealCategoryLabel(targetCategory) ?? "Category overlap"]
      });
    }

    if (
      targetRestrictedCategories.length > 0 &&
      categoryMatches(other, targetRestrictedCategories)
    ) {
      results.push({
        type: "competitor_restriction",
        level: "hard_conflict",
        severity: "high",
        confidence: 0.88,
        title: `Restricted competitor overlap with ${other.deal.brandName}`,
        detail: `This deal restricts work in ${targetRestrictedCategories.join(", ")}, and ${other.deal.brandName} appears to fall inside that restriction.`,
        relatedDealIds: [other.deal.id],
        evidenceRefs: targetRestrictedCategories
      });
    }

    if (
      otherRestrictedCategories.length > 0 &&
      categoryMatches(target, otherRestrictedCategories)
    ) {
      results.push({
        type: "competitor_restriction",
        level: "hard_conflict",
        severity: "high",
        confidence: 0.88,
        title: `Existing deal restrictions may block this deal`,
        detail: `${other.deal.brandName} includes restricted categories (${otherRestrictedCategories.join(", ")}), and this deal appears to overlap with them.`,
        relatedDealIds: [other.deal.id],
        evidenceRefs: otherRestrictedCategories
      });
    }

    if (
      windowsOverlap(targetWindow, otherWindow) &&
      (targetTerms.exclusivityApplies || otherTerms.exclusivityApplies) &&
      targetCategory &&
      otherCategory &&
      targetCategory === otherCategory
    ) {
      results.push({
        type: "exclusivity_overlap",
        level: "hard_conflict",
        severity: "high",
        confidence: 0.9,
        title: `Exclusivity overlap with ${other.deal.brandName}`,
        detail: `Both deals appear active in the same category and their campaign windows overlap. Review exclusivity terms before posting or signing.`,
        relatedDealIds: [other.deal.id],
        evidenceRefs: uniqueStrings([
          targetTerms.exclusivityDuration,
          otherTerms.exclusivityDuration,
          targetWindow?.postingWindow,
          otherWindow?.postingWindow
        ])
      });
    }

    if (windowsOverlap(targetWindow, otherWindow) || withinDays(targetWindow, otherWindow, 3)) {
      results.push({
        type: "schedule_collision",
        level: "warning",
        severity: "medium",
        confidence: windowsOverlap(targetWindow, otherWindow) ? 0.83 : 0.68,
        title: `Schedule overlap with ${other.deal.brandName}`,
        detail: `The posting or deliverable window for this deal appears to overlap with ${other.deal.brandName}. Check that the creator calendar and approval deadlines are realistic.`,
        relatedDealIds: [other.deal.id],
        evidenceRefs: uniqueStrings([
          targetWindow?.postingWindow,
          otherWindow?.postingWindow
        ])
      });
    }
  }

  const deduped = new Map<string, ConflictResult>();
  for (const result of results) {
    const key = `${result.type}:${result.relatedDealIds.join(",")}:${result.title}`;
    if (!deduped.has(key)) {
      deduped.set(key, result);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const levelOrder = { hard_conflict: 3, warning: 2, informational: 1 };
    const severityDelta = severityOrder[right.severity] - severityOrder[left.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const levelDelta = levelOrder[right.level] - levelOrder[left.level];
    if (levelDelta !== 0) {
      return levelDelta;
    }

    return right.confidence - left.confidence;
  });
}

export function mergeConflictIntelligence(
  base: TermsData,
  patch: Partial<TermsData>
): Pick<
  TermsData,
  | "competitorCategories"
  | "restrictedCategories"
  | "disclosureObligations"
  | "campaignDateWindow"
> {
  const baseCompetitorCategories = Array.isArray(base.competitorCategories)
    ? base.competitorCategories
    : [];
  const patchCompetitorCategories = Array.isArray(patch.competitorCategories)
    ? patch.competitorCategories
    : [];
  const baseRestrictedCategories = Array.isArray(base.restrictedCategories)
    ? base.restrictedCategories
    : [];
  const patchRestrictedCategories = Array.isArray(patch.restrictedCategories)
    ? patch.restrictedCategories
    : [];
  const baseDisclosureObligations = Array.isArray(base.disclosureObligations)
    ? base.disclosureObligations
    : [];
  const patchDisclosureObligations = Array.isArray(patch.disclosureObligations)
    ? patch.disclosureObligations
    : [];

  return {
    competitorCategories: uniqueStrings([
      ...baseCompetitorCategories,
      ...patchCompetitorCategories
    ]),
    restrictedCategories: uniqueStrings([
      ...baseRestrictedCategories,
      ...patchRestrictedCategories
    ]),
    disclosureObligations: Array.from(
      new Map(
        [...baseDisclosureObligations, ...patchDisclosureObligations].map((entry) => [
          `${entry.title}:${entry.detail}`,
          entry
        ])
      ).values()
    ),
    campaignDateWindow: patch.campaignDateWindow ?? base.campaignDateWindow
  };
}

export function sortConflictResults(results: ConflictResult[]) {
  return [...results].sort((left, right) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[right.severity] - severityOrder[left.severity];
  });
}

export function countConflictSeverity(results: ConflictResult[]) {
  return results.reduce(
    (counts, result) => {
      counts.total += 1;
      counts[result.severity] += 1;
      return counts;
    },
    { total: 0, high: 0, medium: 0, low: 0 }
  );
}

export function dateWindowLabel(window: CampaignDateWindow | null | undefined) {
  if (!window) {
    return "Not detected";
  }

  return window.postingWindow ?? window.startDate?.slice(0, 10) ?? window.endDate?.slice(0, 10) ?? "Not detected";
}

export function compareDateWindow(a: CampaignDateWindow | null, b: CampaignDateWindow | null) {
  return compareDates(a?.startDate ?? null, b?.startDate ?? null);
}
