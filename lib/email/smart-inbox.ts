import type {
  DealAggregate,
  DealTermsRecord,
  EmailDealEventCategory,
  EmailMessageRecord,
  EmailThreadDetail,
  EmailThreadListItem,
  PendingExtractionData,
  PromiseDiscrepancy
} from "@/lib/types";

type MatchResult = {
  confidence: number;
  reasons: string[];
  evidence: Record<string, unknown>;
};

type ImportantEventDraft = {
  category: EmailDealEventCategory;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
};

type TermSuggestionDraft = {
  title: string;
  summary: string;
  patch: Partial<PendingExtractionData>;
  evidence: Record<string, unknown>;
};

function tokenize(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function threadCorpus(thread: EmailThreadListItem | EmailThreadDetail) {
  const participants = thread.thread.participants.flatMap((participant) => [
    participant.name ?? "",
    participant.email
  ]);
  const base = [thread.thread.subject, thread.thread.snippet ?? "", ...participants];

  if ("messages" in thread) {
    base.push(
      ...thread.messages.flatMap((message) => [
        message.subject,
        message.textBody ?? "",
        message.from?.name ?? "",
        message.from?.email ?? "",
        ...message.to.map((participant) => participant.email),
        ...message.attachments.map((attachment) => attachment.filename),
        ...message.attachments.map((attachment) => attachment.extractedText ?? "")
      ])
    );
  }

  return compactText(base.join("\n")).toLowerCase();
}

function domainHints(thread: EmailThreadListItem | EmailThreadDetail) {
  return unique(
    thread.thread.participants.map((participant) => participant.email.split("@")[1]?.toLowerCase() ?? null)
  );
}

function partnershipTerms(aggregate: DealAggregate) {
  const terms = aggregate.terms;
  return unique([
    aggregate.deal.brandName,
    aggregate.deal.campaignName,
    terms?.brandName ?? null,
    terms?.campaignName ?? null,
    terms?.agencyName ?? null,
    terms?.creatorName ?? null
  ]);
}

function strongTermMatches(corpus: string, labels: string[]) {
  return labels.filter((label) => label.length >= 4 && corpus.includes(label.toLowerCase()));
}

function nameTokenMatches(corpusTokens: Set<string>, labels: string[]) {
  return labels.filter((label) =>
    tokenize(label).some((token) => corpusTokens.has(token))
  );
}

function domainMatches(domains: string[], labels: string[]) {
  const normalizedLabels = labels.map((label) => label.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return domains.filter((domain) =>
    normalizedLabels.some((label) => label.length >= 4 && domain.replace(/[^a-z0-9]/g, "").includes(label))
  );
}

export function scoreThreadAgainstDeal(
  thread: EmailThreadListItem | EmailThreadDetail,
  aggregate: DealAggregate
): MatchResult | null {
  const corpus = threadCorpus(thread);
  const tokens = new Set(tokenize(corpus));
  const labels = partnershipTerms(aggregate);
  const exactMatches = strongTermMatches(corpus, labels);
  const tokenMatches = nameTokenMatches(tokens, labels);
  const domains = domainHints(thread);
  const matchedDomains = domainMatches(domains, labels);

  let score = 0;
  const reasons: string[] = [];

  if (exactMatches.some((match) => match.toLowerCase() === aggregate.deal.campaignName.toLowerCase())) {
    score += 0.5;
    reasons.push(`Campaign name matched subject or thread text: ${aggregate.deal.campaignName}`);
  }

  if (exactMatches.some((match) => match.toLowerCase() === aggregate.deal.brandName.toLowerCase())) {
    score += 0.35;
    reasons.push(`Brand name matched thread content: ${aggregate.deal.brandName}`);
  }

  const supportingTerms = exactMatches.filter(
    (match) =>
      match.toLowerCase() !== aggregate.deal.campaignName.toLowerCase() &&
      match.toLowerCase() !== aggregate.deal.brandName.toLowerCase()
  );
  if (supportingTerms.length > 0) {
    score += Math.min(0.18, supportingTerms.length * 0.09);
    reasons.push(`Supporting partnership terms matched: ${supportingTerms.slice(0, 3).join(", ")}`);
  }

  if (tokenMatches.length > 0) {
    score += Math.min(0.12, tokenMatches.length * 0.04);
    reasons.push(`Participant or snippet tokens overlap with partnership terms.`);
  }

  if (matchedDomains.length > 0) {
    score += 0.12;
    reasons.push(`Participant email domain resembles workspace brand or agency.`);
  }

  if (thread.thread.isContractRelated) {
    score += 0.08;
    reasons.push("Thread content looks contract or negotiation related.");
  }

  if (thread.links.some((link) => link.dealId === aggregate.deal.id)) {
    score = Math.max(score, 0.99);
    reasons.push("Thread is already linked to this partnership.");
  }

  if (score < 0.42) {
    return null;
  }

  return {
    confidence: Math.min(0.99, Number(score.toFixed(2))),
    reasons,
    evidence: {
      exactMatches,
      tokenMatches,
      matchedDomains,
      participantEmails: thread.thread.participants.map((participant) => participant.email)
    }
  };
}

function textForMessage(
  message: EmailMessageRecord,
  options?: {
    includeAttachmentNames?: boolean;
    includeAttachmentExtractedText?: boolean;
  }
) {
  const parts = [message.subject, message.textBody ?? ""];

  if (options?.includeAttachmentNames) {
    parts.push(...message.attachments.map((attachment) => attachment.filename));
  }

  if (options?.includeAttachmentExtractedText) {
    parts.push(...message.attachments.map((attachment) => attachment.extractedText ?? ""));
  }

  return compactText(parts.join("\n")).toLowerCase();
}

function firstLine(text: string) {
  const line = compactText(text).split(/[\n.]/)[0];
  return line || "Important workspace-related email update.";
}

export function detectImportantEmailEvents(
  message: EmailMessageRecord
): ImportantEventDraft[] {
  const text = textForMessage(message);
  const drafts: ImportantEventDraft[] = [];

  const checks: Array<{
    category: EmailDealEventCategory;
    pattern: RegExp;
    title: string;
  }> = [
    { category: "payment", pattern: /\b(invoice|payment|paid|wire|ach|net\s*\d+|remit)\b/i, title: "Payment-related update" },
    { category: "timeline", pattern: /\b(due|deadline|timeline|schedule|reschedule|calendar|tomorrow|next week|this week|by (?:eod|end of day|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i, title: "Timeline or scheduling update" },
    { category: "deliverable", pattern: /\b(deliverable|draft|final|revision|reel|story|post|video|ugc)\b/i, title: "Deliverable-related update" },
    { category: "approval", pattern: /\b(approve|approved|approval|looks good|accepted|reject|rejected|declined)\b/i, title: "Approval status update" },
    { category: "rights", pattern: /\b(usage|rights|whitelist|whitelisting|exclusiv|organic|paid social|license|territory)\b/i, title: "Usage rights or exclusivity update" },
    { category: "ask", pattern: /\b(can you|could you|would you|need you to|please (?:confirm|send|share|review|approve|sign|reply)|let me know (?:if|when|whether)|confirm(?: that| you can)?|send over|share (?:your|the)|review and sign|sign and return)\b/i, title: "Action requested from the creator" }
  ];

  for (const check of checks) {
    if (!check.pattern.test(text)) {
      continue;
    }

    drafts.push({
      category: check.category,
      title: check.title,
      body: firstLine(message.textBody ?? message.subject),
      metadata: {
        subject: message.subject
      }
    });
  }

  const meaningfulAttachments = message.attachments.filter((attachment) =>
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|png|jpg|jpeg|mov|mp4)$/i.test(attachment.filename)
  );
  if (meaningfulAttachments.length > 0) {
    drafts.push({
      category: "attachment",
      title: "New attachment added to linked thread",
      body: `Attachment(s): ${meaningfulAttachments.map((attachment) => attachment.filename).join(", ")}`,
      metadata: {
        filenames: meaningfulAttachments.map((attachment) => attachment.filename)
      }
    });
  }

  return drafts;
}

function parsePaymentTerms(text: string) {
  const netMatch = text.match(/\bnet\s*(\d{1,3})\b/i);
  if (netMatch) {
    return {
      paymentTerms: `Net ${netMatch[1]}`,
      netTermsDays: Number(netMatch[1])
    };
  }

  return null;
}

function parseUsageHints(text: string) {
  if (!/\b(usage|rights|whitelist|whitelisting|organic|paid social|exclusiv|license)\b/i.test(text)) {
    return null;
  }

  const parts: string[] = [];
  if (/organic/i.test(text)) parts.push("Organic");
  if (/paid social/i.test(text)) parts.push("Paid social");
  if (/whitelist|whitelisting/i.test(text)) parts.push("Whitelisting");
  if (/exclusive|exclusivity/i.test(text)) parts.push("Exclusivity");

  return {
    usageRights: parts.length > 0 ? parts.join(", ") : "Usage rights discussed in email thread."
  };
}

function parseDurationHint(text: string) {
  const match = text.match(/\b(\d{1,2})\s*(day|days|week|weeks|month|months|year|years)\b/i);
  if (!match || !/\b(usage|rights|term|license|exclusiv)\b/i.test(text)) {
    return null;
  }

  return `${match[1]} ${match[2]}`;
}

function existingTerms(aggregate: DealAggregate): DealTermsRecord | null {
  return aggregate.terms ?? null;
}

export function buildEmailTermSuggestion(
  aggregate: DealAggregate,
  thread: EmailThreadDetail,
  message: EmailMessageRecord
): TermSuggestionDraft | null {
  const text = textForMessage(message, {
    includeAttachmentNames: true,
    includeAttachmentExtractedText: true
  });
  const current = existingTerms(aggregate);
  const payment = parsePaymentTerms(text);
  const usage = parseUsageHints(text);
  const duration = parseDurationHint(text);

  const patch: Partial<PendingExtractionData> = {};

  if (payment && (!current?.netTermsDays || current.netTermsDays !== payment.netTermsDays)) {
    patch.paymentTerms = payment.paymentTerms;
    patch.netTermsDays = payment.netTermsDays;
  }

  if (usage && compactText(current?.usageRights).toLowerCase() !== usage.usageRights.toLowerCase()) {
    patch.usageRights = usage.usageRights;
  }

  if (duration && compactText(current?.usageDuration).toLowerCase() !== duration.toLowerCase()) {
    patch.usageDuration = duration;
  }

  if (message.attachments.length > 0) {
    patch.notes = unique([
      current?.notes ?? null,
      `Email attachments received: ${message.attachments.map((attachment) => attachment.filename).join(", ")}`
    ]).join("\n");
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }

  return {
    title: "Email suggests partnership term updates",
    summary: `New linked thread details may change key terms for ${aggregate.deal.campaignName}.`,
    patch,
    evidence: {
      threadId: thread.thread.id,
      messageId: message.id,
      subject: message.subject,
      attachmentNames: message.attachments.map((attachment) => attachment.filename)
    }
  };
}

// fallow-ignore-next-line complexity
export function detectPromiseDiscrepancies(
  aggregate: DealAggregate,
  message: EmailMessageRecord
): PromiseDiscrepancy[] {
  if (message.direction === "outbound") {
    return [];
  }

  const terms = aggregate.terms;
  if (!terms) {
    return [];
  }

  const text = textForMessage(message);
  if (!text || text.length < 20) {
    return [];
  }

  const discrepancies: PromiseDiscrepancy[] = [];

  // Check duration claims vs contract
  const durationMatch = text.match(/\b(\d{1,3})\s*(day|days|week|weeks|month|months|year|years)\b/i);
  if (durationMatch && terms.usageDuration) {
    const emailDuration = `${durationMatch[1]} ${durationMatch[2]}`;
    const contractDuration = terms.usageDuration.toLowerCase();
    const emailMonths = normalizeToMonths(durationMatch[1], durationMatch[2]);
    const contractMonths = extractMonthsFromDuration(contractDuration);

    if (
      emailMonths !== null &&
      contractMonths !== null &&
      emailMonths !== contractMonths &&
      /\b(usage|rights|license|term|content|exclusiv)\b/i.test(text)
    ) {
      discrepancies.push({
        field: "usageDuration",
        emailClaim: emailDuration,
        contractValue: terms.usageDuration,
        severity: emailMonths > contractMonths ? "high" : "medium",
        sourceText: extractSentenceAround(text, durationMatch.index ?? 0),
        messageId: message.id
      });
    }
  }

  // Check payment amount claims vs contract
  const amountMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  if (amountMatch && terms.paymentAmount) {
    const emailAmount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (
      !isNaN(emailAmount) &&
      emailAmount > 0 &&
      Math.abs(emailAmount - terms.paymentAmount) > 1 &&
      emailAmount !== terms.paymentAmount
    ) {
      discrepancies.push({
        field: "paymentAmount",
        emailClaim: `$${emailAmount.toLocaleString()}`,
        contractValue: `$${terms.paymentAmount.toLocaleString()}`,
        severity: emailAmount < terms.paymentAmount ? "high" : "medium",
        sourceText: extractSentenceAround(text, amountMatch.index ?? 0),
        messageId: message.id
      });
    }
  }

  // Check net terms claims vs contract
  const netMatch = text.match(/\bnet\s*(\d{1,3})\b/i);
  if (netMatch && terms.netTermsDays) {
    const emailNet = parseInt(netMatch[1], 10);
    if (emailNet !== terms.netTermsDays) {
      discrepancies.push({
        field: "netTermsDays",
        emailClaim: `Net ${emailNet}`,
        contractValue: `Net ${terms.netTermsDays}`,
        severity: emailNet > terms.netTermsDays ? "high" : "medium",
        sourceText: extractSentenceAround(text, netMatch.index ?? 0),
        messageId: message.id
      });
    }
  }

  // Check exclusivity claims vs contract
  if (terms.exclusivityApplies === false && /\bexclusiv/i.test(text)) {
    const exclusivityContext = text.match(/[^.]*\bexclusiv[^.]*\./i);
    if (exclusivityContext && !/\bnon[- ]?exclusiv/i.test(exclusivityContext[0])) {
      discrepancies.push({
        field: "exclusivity",
        emailClaim: "Exclusivity mentioned in email",
        contractValue: "Contract specifies non-exclusive",
        severity: "high",
        sourceText: exclusivityContext[0].trim().slice(0, 200),
        messageId: message.id
      });
    }
  }

  // Check revision count claims vs contract
  const revisionMatch = text.match(/\b(\d{1,2})\s*(?:rounds?\s+of\s+)?revision/i);
  if (revisionMatch && terms.revisionRounds) {
    const emailRevisions = parseInt(revisionMatch[1], 10);
    if (emailRevisions > terms.revisionRounds) {
      discrepancies.push({
        field: "revisionRounds",
        emailClaim: `${emailRevisions} revisions`,
        contractValue: `${terms.revisionRounds} revisions`,
        severity: "medium",
        sourceText: extractSentenceAround(text, revisionMatch.index ?? 0),
        messageId: message.id
      });
    }
  }

  // Check deliverable count claims vs contract
  const deliverableCountMatch = text.match(/\b(\d{1,2})\s*(?:additional\s+)?(?:reel|video|post|story|stories|tiktok|deliverable)/i);
  if (deliverableCountMatch && terms.deliverables.length > 0) {
    const emailCount = parseInt(deliverableCountMatch[1], 10);
    const contractTotal = terms.deliverables.reduce((sum, d) => sum + (d.quantity ?? 0), 0);
    if (emailCount > contractTotal && contractTotal > 0) {
      discrepancies.push({
        field: "deliverables",
        emailClaim: `${emailCount} deliverables mentioned`,
        contractValue: `${contractTotal} deliverables in contract`,
        severity: "high",
        sourceText: extractSentenceAround(text, deliverableCountMatch.index ?? 0),
        messageId: message.id
      });
    }
  }

  return discrepancies;
}

function normalizeToMonths(value: string, unit: string): number | null {
  const num = parseInt(value, 10);
  if (isNaN(num)) return null;

  const u = unit.toLowerCase().replace(/s$/, "");
  switch (u) {
    case "day": return Math.round(num / 30);
    case "week": return Math.round(num / 4);
    case "month": return num;
    case "year": return num * 12;
    default: return null;
  }
}

function extractMonthsFromDuration(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*(day|week|month|year)s?/i);
  if (!match) return null;
  return normalizeToMonths(match[1], match[2]);
}

function extractSentenceAround(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf(".", Math.max(0, index - 1)) + 1);
  const end = text.indexOf(".", index);
  const sentence = text.slice(start, end > index ? end + 1 : Math.min(text.length, index + 150));
  return sentence.trim().slice(0, 200);
}

const STRONG_SUBJECT_PATTERNS = [
  /\bbrand\s*(?:deal|partnership|collab(?:oration)?|ambassador|opportunity|offer|inquiry)\b/i,
  /\bsponsor(?:ship|ed)?\b/i,
  /\bpartnership\s*(?:opportunity|inquiry|request|proposal|offer)\b/i,
  /\b(?:paid|gifted|compensated)\s*(?:partnership|collab(?:oration)?|sponsor|post|content|deal|opportunity)\b/i,
  /\bcollab(?:oration)?\s*(?:opportunity|inquiry|offer|proposal|request|deal)\b/i,
  /\b(?:ambassador|influencer|creator)\s*(?:program|opportunity|partnership|campaign|deal|search|application)\b/i,
  /\bugc\s*(?:campaign|content|creator|deal|opportunity|project)\b/i,
  /\b(?:gifting|gifted)\s*(?:collab|opportunity|campaign|partnership|deal)\b/i,
  /\bproduct\s*seed(?:ing)?\b/i,
  /\bpr\s*(?:package|box|kit|sample)\b/i,
  /\bmedia\s*kit\b/i,
  /\brate\s*card\b/i,
  /\b(?:content|creative)\s*brief\b/i,
  /\bscope\s*of\s*work\b/i,
  /\b(?:talent|booking)\s*(?:inquiry|management|agency|request)\b/i,
  /\bcampaign\s*(?:brief|proposal|offer|deal|terms|details)\b/i,
];

const BODY_CATEGORY_PATTERNS = [
  /\b(compensation|deliverables?|scope\s*of\s*work|flat\s*(?:fee|rate)|payment\s*terms|content\s*brief|creative\s*brief|rate\s*card|media\s*kit|usage\s*(?:rights|license))\b/i,
  /\b(tiktok|reel|ugc\b|user[- ]?generated\s*content|content\s*(?:creation|calendar)|youtube\s*(?:shorts?|videos?)|instagram\s*(?:reels?|stories?|posts?))\b/i,
  /\b(exclusiv|whitelist|whitelisting|paid\s*social|organic\s*(?:post|content|placement)|barter|seeding|sponsorship|ambassador|influencer|creator\s*(?:fund|program))\b/i,
  /\b(collab(?:oration)?|partnership|sponsor)\b/i,
  /\b(we\s*(?:would\s*love|want|'d\s*like)\s*to\s*(?:work|collab|partner)|interested\s*in\s*(?:a\s*)?(?:collab|partnership|sponsor|working)|would\s*you\s*be\s*(?:interested|open)|open\s*to\s*(?:a\s*)?(?:collab|partnership|sponsor))\b/i,
];

const OUTREACH_PATTERNS = [
  /\breaching\s+out\s+(?:on\s+behalf\s+of|from|because)\b/i,
  /\bcame\s+across\s+your\s+content\b/i,
  /\b(?:been\s+following|love|enjoy)\s+your\s+content\b/i,
  /\byou(?:'d|\s+would)\s+be\s+perfect\s+for\b/i,
  /\b(?:invite|inviting)\s+you\s+to\s+(?:collab(?:orate)?|partner)\b/i,
];

const SUBJECT_COLLAB_PATTERN = /\b(collab(?:oration)?|partnership|sponsor(?:ship)?)\b/i;
const SUBJECT_CONTEXT_PATTERN = /\b(campaign|idea|concept|test|launch|holiday)\b/i;
const SUBJECT_BRAND_PAIR_PATTERN =
  /\b[a-z0-9&][a-z0-9&' -]{1,40}\s+x\s+[a-z0-9&][a-z0-9&' -]{1,40}\b/i;

const AGENCY_DOMAIN_WORDS = new Set([
  "talent", "influencer", "creator", "agency", "mgmt",
  "casting", "bookings", "collective", "publicrelations",
]);

export function isLikelyBrandDealEmail(item: EmailThreadListItem): boolean {
  if (item.links.length > 0) {
    return true;
  }

  const subject = compactText(item.thread.subject).toLowerCase();
  const snippet = compactText(item.thread.snippet).toLowerCase();

  for (const pattern of STRONG_SUBJECT_PATTERNS) {
    if (pattern.test(subject) || pattern.test(snippet)) {
      return true;
    }
  }

  const combined = `${subject} ${snippet}`;
  const matchedCategories = BODY_CATEGORY_PATTERNS.filter((p) => p.test(combined));
  if (matchedCategories.length >= 2) {
    return true;
  }

  const hasCollabLanguage = SUBJECT_COLLAB_PATTERN.test(combined);
  const hasPitchContext =
    SUBJECT_CONTEXT_PATTERN.test(subject) ||
    SUBJECT_BRAND_PAIR_PATTERN.test(subject) ||
    OUTREACH_PATTERNS.some((pattern) => pattern.test(combined));
  if (hasCollabLanguage && hasPitchContext) {
    return true;
  }

  for (const participant of item.thread.participants) {
    const domain = participant.email.split("@")[1]?.toLowerCase();
    if (domain) {
      const parts = domain.replace(/\.[a-z]+$/, "").split(/[.\-]/);
      if (parts.some((part) => AGENCY_DOMAIN_WORDS.has(part))) {
        return true;
      }
    }
  }

  return false;
}
