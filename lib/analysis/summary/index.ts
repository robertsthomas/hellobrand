/**
 * Heuristic (non-LLM) summary building, brief data extraction, and document-level analysis orchestration.
 */
import type {
  BriefData,
  DealAggregate,
  DocumentAnalysisResult,
  DocumentKind,
  ExtractionPipelineResult,
  GeneratedBrief,
  GeneratedBriefSection,
  RiskFlagRecord
} from "@/lib/types";
import { sanitizeCampaignName } from "@/lib/party-labels";
import {
  classifyDocumentHeuristically,
  extractStructuredTerms,
  inferBriefBrandName,
  inferBriefCampaignName,
  isBriefLikeDocumentKind,
  parseBriefDeliverables,
  shouldUseInferredBriefBrandName,
  splitIntoSections
} from "@/lib/analysis/extract";
import { analyzeCreatorRisks } from "@/lib/analysis/risks";

// fallow-ignore-next-line complexity
export function buildCreatorSummary(
  extraction: ExtractionPipelineResult,
  risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">>
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

function isGenericCampaignName(value: string | null | undefined) {
  return sanitizeCampaignName(value) === null;
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

  function extractHandle() {
    const match = text.match(/@[a-z0-9._]{2,}/i);
    return match?.[0] ?? null;
  }

  function detectPlatforms() {
    const platformMatchers = [
      { label: "Instagram", pattern: /\binstagram\b|\big\b|\breel\b|\bstory\b|\bstories\b/i },
      { label: "TikTok", pattern: /\btik\s?tok\b/i },
      { label: "YouTube", pattern: /\byoutube\b|\bshorts?\b/i },
      { label: "Facebook", pattern: /\bfacebook\b/i },
      { label: "LinkedIn", pattern: /\blinkedin\b/i },
      { label: "Newsletter", pattern: /\bnewsletter\b/i },
      { label: "Podcast", pattern: /\bpodcast\b/i },
    ];

    return platformMatchers
      .filter((entry) => entry.pattern.test(text))
      .map((entry) => entry.label);
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

  const deliverablesSummary = extractAfterLabel([
    /(?:^|\n)(?:deliverables summary|required deliverables|content deliverables|deliverables)\s*:\s*\n?([\s\S]{10,500}?)(?:\n{2,}|\n[A-Z][^\n]{0,80}:|$)/i
  ]);

  const brandGuidelines = extractAfterLabel([
    /(?:brand guidelines?|style guide)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const approvalRequirements = extractAfterLabel([
    /(?:approval (?:process|requirements?|workflow))[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const revisionRequirements = extractAfterLabel([
    /(?:revision requirements?|revisions?)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const targetAudience = extractAfterLabel([
    /(?:target audience|audience)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const toneAndStyle = extractAfterLabel([
    /(?:tone (?:and|&) style|tone|voice)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const requiredClaims = extractListAfterLabel([
    /(?:required claims?|mandatory claims?|required messaging)[:\s]*\n?([\s\S]{10,800}?)(?:\n\n|\n[A-Z])/i
  ]);

  const disclosureRequirements = extractListAfterLabel([
    /(?:disclosure requirements?|disclosures?|hashtags?|hashtag requirements?)[:\s]*\n?([\s\S]{10,800}?)(?:\n\n|\n[A-Z])/i
  ]);

  const competitorRestrictions = extractListAfterLabel([
    /(?:competitor restrictions?|competitor exclusions?|avoid competitors?|category exclusivity)[:\s]*\n?([\s\S]{10,800}?)(?:\n\n|\n[A-Z])/i
  ]);

  const linksAndAssets = extractListAfterLabel([
    /(?:links? and assets|assets|links?)[:\s]*\n?([\s\S]{10,800}?)(?:\n\n|\n[A-Z])/i
  ]);

  const postingSchedule = extractAfterLabel([
    /(?:posting schedule|posting window|timeline|schedule)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z])/i
  ]);

  const campaignLiveDate = extractAfterLabel([
    /(?:campaign live date|go live date|launch date)[:\s]*\n?([^\n]{4,120})/i
  ]);

  const campaignFlight = extractAfterLabel([
    /(?:campaign flight|flight dates?|campaign dates?)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const draftDueDate = extractAfterLabel([
    /(?:draft due date|draft due)[:\s]*\n?([^\n]{4,120})/i
  ]);

  const contentDueDate = extractAfterLabel([
    /(?:content due date|content due)[:\s]*\n?([^\n]{4,120})/i
  ]);

  const paymentSchedule = extractAfterLabel([
    /(?:payment schedule|payment timing)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const paymentRequirements = extractAfterLabel([
    /(?:payment requirements?|billing requirements?)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const paymentNotes = extractAfterLabel([
    /(?:payment notes?|billing notes?)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const amplificationPeriod = extractAfterLabel([
    /(?:amplification period|paid amplification period|amplification window)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const reportingRequirements = extractAfterLabel([
    /(?:reporting requirements?|performance reporting|reporting)[:\s]*\n?([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
  ]);

  const creatorHandle = extractHandle();
  const deliverablePlatforms = detectPlatforms();

  const doNotMention = extractListAfterLabel([
    /(?:do not mention|avoid|don't mention|do not include)[:\s]*\n?([\s\S]{10,500}?)(?:\n\n|\n[A-Z]|$)/i
  ]);

  const hasContent =
    campaignOverview ||
    messagingPoints.length > 0 ||
    talkingPoints.length > 0 ||
    creativeConceptOverview ||
    deliverablesSummary ||
    brandGuidelines ||
    approvalRequirements ||
    revisionRequirements ||
    targetAudience ||
    toneAndStyle ||
    requiredClaims.length > 0 ||
    disclosureRequirements.length > 0 ||
    competitorRestrictions.length > 0 ||
    linksAndAssets.length > 0 ||
    postingSchedule ||
    campaignLiveDate ||
    campaignFlight ||
    draftDueDate ||
    contentDueDate ||
    paymentSchedule ||
    paymentRequirements ||
    paymentNotes ||
    amplificationPeriod ||
    reportingRequirements ||
    creatorHandle ||
    deliverablePlatforms.length > 0 ||
    doNotMention.length > 0;

  if (!hasContent) {
    return null;
  }

  return {
    campaignOverview,
    messagingPoints,
    talkingPoints,
    creativeConceptOverview,
    requiredClaims,
    brandGuidelines,
    approvalRequirements,
    revisionRequirements,
    targetAudience,
    toneAndStyle,
    deliverablesSummary,
    deliverablePlatforms,
    creatorHandle,
    postingSchedule,
    campaignLiveDate,
    campaignFlight,
    draftDueDate,
    contentDueDate,
    paymentSchedule,
    paymentRequirements,
    paymentNotes,
    amplificationPeriod,
    reportingRequirements,
    disclosureRequirements,
    competitorRestrictions,
    linksAndAssets,
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

// fallow-ignore-next-line complexity
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
