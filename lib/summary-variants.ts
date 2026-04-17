import {
  generateSimplifiedSummaryWithLlm,
  hasLlmKey
} from "@/lib/analysis/llm";
import {
  parseDealSummarySections,
  serializeDealSummarySections,
  toPlainDealSummary,
  type DealSummarySection
} from "@/lib/deal-summary";
import type {
  DealAggregate,
  DeliverableItem,
  DisclosureObligation,
  DocumentSummaryResult,
  SummaryRecord,
  SummaryRecordInput,
  SummaryType
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const CANONICAL_SECTION_TITLES = [
  "What this partnership is",
  "What you deliver",
  "What you get paid",
  "Rights and restrictions",
  "Watchouts"
] as const;

const STOP_WORDS = new Set([
  "about",
  "after",
  "and",
  "for",
  "from",
  "into",
  "that",
  "the",
  "this",
  "with",
  "your"
]);

function clipSentence(value: string, count: number) {
  return value
    .split(/(?<=[.!?])\s+/)
    .slice(0, count)
    .join(" ")
    .trim();
}

function formatDeliverableItem(item: DeliverableItem) {
  const quantity =
    item.quantity && item.quantity > 1 ? `${item.quantity} ${item.title}` : item.title;
  const parts = [quantity];

  if (item.channel) {
    parts.push(`for ${item.channel}`);
  }

  if (item.dueDate) {
    parts.push(`due ${item.dueDate}`);
  }

  return parts.join(" ");
}

function summarizeDeliverables(deliverables: DeliverableItem[], compact: boolean) {
  if (deliverables.length === 0) {
    return compact
      ? "Deliverables still need manual confirmation."
      : "Deliverables still need manual confirmation from the contract.";
  }

  const listed = deliverables.slice(0, compact ? 2 : 3).map(formatDeliverableItem);
  const overflow =
    deliverables.length > listed.length
      ? ` plus ${deliverables.length - listed.length} more requirement${deliverables.length - listed.length === 1 ? "" : "s"}`
      : "";

  return compact
    ? `Deliver ${listed.join(", ")}${overflow}.`
    : `You are expected to deliver ${listed.join(", ")}${overflow}.`;
}

function summarizePayment(aggregate: DealAggregate, compact: boolean) {
  const { terms } = aggregate;
  const amount =
    terms?.paymentAmount != null
      ? formatCurrency(terms.paymentAmount, terms.currency ?? "USD")
      : "payment that is not clearly stated yet";
  const detailParts = [
    terms?.paymentTerms,
    terms?.paymentTrigger,
    typeof terms?.netTermsDays === "number" ? `Net ${terms.netTermsDays}` : null
  ].filter((value): value is string => Boolean(value?.trim()));

  if (compact) {
    return detailParts.length > 0
      ? `Pay: ${amount}, ${detailParts.join(", ")}.`
      : `Pay: ${amount}.`;
  }

  return detailParts.length > 0
    ? `You are set to be paid ${amount}. Payment timing is ${detailParts.join(", ")}.`
    : `You are set to be paid ${amount}.`;
}

// fallow-ignore-next-line complexity
function summarizeRights(
  aggregate: DealAggregate,
  compact: boolean,
  baseSections: DealSummarySection[]
) {
  const { terms } = aggregate;
  const usageParts = [
    terms?.usageRights
      ? terms.usageRights
      : terms?.usageRightsPaidAllowed
        ? "paid usage is allowed"
        : terms?.usageRightsOrganicAllowed
          ? "organic usage is allowed"
          : null,
    terms?.usageDuration,
    terms?.usageTerritory,
    terms?.exclusivityDuration
      ? `exclusivity lasts ${terms.exclusivityDuration}`
      : null,
    terms?.exclusivityCategory ? `${terms.exclusivityCategory} exclusivity` : null,
    summarizeDisclosure(terms?.disclosureObligations ?? [], compact)
  ].filter((value): value is string => Boolean(value?.trim()));

  if (usageParts.length > 0) {
    return compact
      ? usageParts.slice(0, 3).join(". ") + "."
      : `Usage and restriction highlights: ${usageParts.join(". ")}.`;
  }

  const baseRights = baseSections.find((section) => section.title === "Rights and restrictions");
  if (baseRights) {
    return clipSentence(baseRights.paragraphs.join(" "), compact ? 1 : 2);
  }

  return compact
    ? "Rights still need manual review."
    : "Rights and restrictions still need a manual read of the legal version.";
}

function summarizeDisclosure(obligations: DisclosureObligation[], compact: boolean) {
  if (obligations.length === 0) {
    return null;
  }

  const first = obligations[0];
  return compact
    ? `Disclosure: ${first.title}`
    : `Disclosure reminder: ${first.title}${first.detail ? `, ${first.detail}` : ""}`;
}

function summarizeWatchouts(aggregate: DealAggregate, compact: boolean) {
  if (aggregate.riskFlags.length === 0) {
    return compact
      ? "No major watchouts were flagged."
      : "No major watchouts were flagged, but keep the legal version handy for edge cases.";
  }

  const topFlags = aggregate.riskFlags.slice(0, compact ? 1 : 2);
  return compact
    ? topFlags.map((flag) => `${flag.title}: ${clipSentence(flag.detail, 1)}`).join(" ")
    : topFlags.map((flag) => `${flag.title}. ${clipSentence(flag.detail, 1)}`).join(" ");
}

function buildFallbackSummarySections(
  aggregate: DealAggregate,
  targetType: Exclude<SummaryType, "legal">,
  baseSummary: SummaryRecord
) {
  const compact = targetType === "short";
  const baseSections = parseDealSummarySections(baseSummary.body);
  const partnerLine = (() => {
    const brand = aggregate.terms?.brandName ?? aggregate.deal.brandName;
    const campaign = aggregate.terms?.campaignName ?? aggregate.deal.campaignName;
    const baseOverview = baseSections.find(
      (section) => section.title === "What this partnership is"
    );

    if (baseOverview) {
      return clipSentence(baseOverview.paragraphs.join(" "), compact ? 1 : 2);
    }

    return compact
      ? `Partnership with ${brand}${campaign ? ` for ${campaign}` : ""}.`
      : `This partnership is with ${brand}${campaign ? ` for ${campaign}` : ""}.`;
  })();

  return [
    {
      id: "what-this-partnership-is",
      title: "What this partnership is",
      paragraphs: [partnerLine]
    },
    {
      id: "what-you-deliver",
      title: "What you deliver",
      paragraphs: [summarizeDeliverables(aggregate.terms?.deliverables ?? [], compact)]
    },
    {
      id: "what-you-get-paid",
      title: "What you get paid",
      paragraphs: [summarizePayment(aggregate, compact)]
    },
    {
      id: "rights-and-restrictions",
      title: "Rights and restrictions",
      paragraphs: [summarizeRights(aggregate, compact, baseSections)]
    },
    {
      id: "watchouts",
      title: "Watchouts",
      paragraphs: [summarizeWatchouts(aggregate, compact)]
    }
  ] satisfies DealSummarySection[];
}

function meaningfulTokens(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 4 &&
            !STOP_WORDS.has(token) &&
            !/^\d+$/.test(token)
        )
    )
  );
}

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function normalizeAmount(amount: number) {
  return Math.round(amount).toString();
}

// fallow-ignore-next-line complexity
export function validateSummaryVariantBody(
  aggregate: DealAggregate,
  body: string
) {
  const sections = parseDealSummarySections(body);
  const byTitle = new Map(sections.map((section) => [section.title, section.paragraphs.join(" ")]));

  for (const title of CANONICAL_SECTION_TITLES) {
    const value = byTitle.get(title)?.trim();
    if (!value) {
      return `Missing the "${title}" section.`;
    }
  }

  const paymentText = (byTitle.get("What you get paid") ?? "").toLowerCase();
  const rightsText = (byTitle.get("Rights and restrictions") ?? "").toLowerCase();
  const deliverableText = (byTitle.get("What you deliver") ?? "").toLowerCase();
  const watchoutsText = (byTitle.get("Watchouts") ?? "").toLowerCase();

  if (aggregate.terms?.paymentAmount != null) {
    const amountDigits = normalizeAmount(aggregate.terms.paymentAmount);
    const collapsed = paymentText.replace(/[^0-9]/g, "");

    if (!collapsed.includes(amountDigits)) {
      return "The simplified summary dropped the payment amount.";
    }
  }

  const paymentAnchors = [
    ...meaningfulTokens(aggregate.terms?.paymentTerms),
    ...meaningfulTokens(aggregate.terms?.paymentTrigger),
    ...(typeof aggregate.terms?.netTermsDays === "number"
      ? [`net${aggregate.terms.netTermsDays}`, String(aggregate.terms.netTermsDays)]
      : [])
  ];

  if (paymentAnchors.length > 0 && !includesAny(paymentText.replace(/\s+/g, ""), paymentAnchors)) {
    return "The simplified summary dropped the payment timing.";
  }

  const deliverableAnchors = (aggregate.terms?.deliverables ?? []).flatMap((item) =>
    meaningfulTokens([item.title, item.channel].filter(Boolean).join(" "))
  );
  if (deliverableAnchors.length > 0 && !includesAny(deliverableText, deliverableAnchors)) {
    return "The simplified summary dropped the deliverable details.";
  }

  const rightsAnchors = [
    ...meaningfulTokens(aggregate.terms?.usageRights),
    ...meaningfulTokens(aggregate.terms?.usageDuration),
    ...meaningfulTokens(aggregate.terms?.usageTerritory),
    ...meaningfulTokens(aggregate.terms?.exclusivityCategory),
    ...meaningfulTokens(aggregate.terms?.exclusivityDuration),
    ...(aggregate.terms?.usageRightsPaidAllowed ? ["paid", "usage"] : []),
    ...(aggregate.terms?.usageRightsOrganicAllowed ? ["organic", "usage"] : []),
    ...(aggregate.terms?.whitelistingAllowed ? ["whitelist"] : []),
    ...(aggregate.terms?.disclosureObligations.length
      ? ["disclosure", "ad"]
      : [])
  ];

  if (rightsAnchors.length > 0 && !includesAny(rightsText, rightsAnchors)) {
    return "The simplified summary dropped rights or restriction details.";
  }

  const watchoutAnchors = aggregate.riskFlags.flatMap((flag) =>
    meaningfulTokens(`${flag.title} ${flag.detail}`)
  );
  if (watchoutAnchors.length > 0 && !includesAny(watchoutsText, watchoutAnchors)) {
    return "The simplified summary dropped the main watchouts.";
  }

  return null;
}

// fallow-ignore-next-line complexity
function buildGroundingPayload(aggregate: DealAggregate, baseSummary: SummaryRecord) {
  return {
    baseSummary: toPlainDealSummary(baseSummary.body) ?? baseSummary.body,
    deal: {
      brandName: aggregate.terms?.brandName ?? aggregate.deal.brandName,
      campaignName: aggregate.terms?.campaignName ?? aggregate.deal.campaignName
    },
    payment: {
      amount: aggregate.terms?.paymentAmount ?? null,
      currency: aggregate.terms?.currency ?? "USD",
      paymentTerms: aggregate.terms?.paymentTerms ?? null,
      paymentTrigger: aggregate.terms?.paymentTrigger ?? null,
      netTermsDays: aggregate.terms?.netTermsDays ?? null
    },
    deliverables: (aggregate.terms?.deliverables ?? []).map((item) => ({
      title: item.title,
      channel: item.channel,
      quantity: item.quantity,
      dueDate: item.dueDate
    })),
    rights: {
      usageRights: aggregate.terms?.usageRights ?? null,
      usageDuration: aggregate.terms?.usageDuration ?? null,
      usageTerritory: aggregate.terms?.usageTerritory ?? null,
      usageChannels: aggregate.terms?.usageChannels ?? [],
      organicAllowed: aggregate.terms?.usageRightsOrganicAllowed ?? null,
      paidAllowed: aggregate.terms?.usageRightsPaidAllowed ?? null,
      whitelistingAllowed: aggregate.terms?.whitelistingAllowed ?? null
    },
    exclusivity: {
      applies: aggregate.terms?.exclusivityApplies ?? null,
      category: aggregate.terms?.exclusivityCategory ?? null,
      duration: aggregate.terms?.exclusivityDuration ?? null,
      restrictions: aggregate.terms?.exclusivityRestrictions ?? null
    },
    disclosure: aggregate.terms?.disclosureObligations ?? [],
    watchouts: aggregate.riskFlags.slice(0, 5).map((flag) => ({
      title: flag.title,
      detail: flag.detail,
      severity: flag.severity,
      category: flag.category
    }))
  };
}

export async function buildGeneratedSummaryVariant(input: {
  aggregate: DealAggregate;
  baseSummary: SummaryRecord;
  targetType: Exclude<SummaryType, "legal">;
}) {
  const fallbackSections = buildFallbackSummarySections(
    input.aggregate,
    input.targetType,
    input.baseSummary
  );
  const fallback: DocumentSummaryResult = {
    body: serializeDealSummarySections(fallbackSections),
    version: `fallback:${input.targetType}`,
    summaryType: input.targetType,
    source: "simplification",
    parentSummaryId: input.baseSummary.id,
    isCurrent: true
  };

  if (!hasLlmKey()) {
    return fallback satisfies SummaryRecordInput;
  }

  try {
    const generated = await generateSimplifiedSummaryWithLlm({
      targetType: input.targetType,
      baseSummary: input.baseSummary.body,
      grounding: buildGroundingPayload(input.aggregate, input.baseSummary),
      fallback
    });
    const validationError = validateSummaryVariantBody(input.aggregate, generated.body);

    if (validationError) {
      return fallback satisfies SummaryRecordInput;
    }

    return {
      ...generated,
      summaryType: input.targetType,
      source: "simplification",
      parentSummaryId: input.baseSummary.id,
      isCurrent: true
    } satisfies SummaryRecordInput;
  } catch {
    return fallback satisfies SummaryRecordInput;
  }
}
