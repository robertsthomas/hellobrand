import type {
  DealAggregate,
  EmailMessageRecord,
  EmailThreadDetail,
  ProfileRecord,
} from "@/lib/types";

type ThreadConversationMode =
  | "initial_offer"
  | "rate_negotiation"
  | "decline_affiliate"
  | "follow_up_decision"
  | "revision_cycle"
  | "go_live"
  | "invoice_closeout"
  | "unsubscribe_or_ignore"
  | "low_signal_follow_up";

type CompensationType = "guaranteed_paid" | "affiliate" | "hybrid" | "gifted" | "unclear";

type NextMoveOwner = "creator" | "brand" | "none";

interface ActiveTerms {
  compensation: string | null;
  deliverables: string | null;
  deadlines: string | null;
  usageRights: string | null;
  exclusivity: string | null;
  paymentTiming: string | null;
}

interface ThreadBrief {
  mode: ThreadConversationMode;
  compensationType: CompensationType;
  latestInboundAsk: string | null;
  lastCreatorPosition: string | null;
  nextMoveOwner: NextMoveOwner;
  activeTerms: ActiveTerms;
  openQuestions: string[];
  blockers: string[];
  risks: string[];
  spamConfidence: "none" | "low" | "medium" | "high";
  brandName: string | null;
  threadPhase: "early" | "mid" | "late";
}

const UNSUBSCRIBE_PATTERNS: RegExp[] = [
  /\bremove\s+me\b/i,
  /\bunsubscribe\b/i,
  /\bstop\s+(?:emailing|sending|contacting|messaging)\b/i,
  /\bdo\s+not\s+(?:contact|email|reach\s+out)\b/i,
  /\bnot\s+interested\b/i,
  /\bplease\s+remove\b/i,
  /\btake\s+me\s+off\b/i,
];

const INVOICE_PATTERNS: RegExp[] = [
  /\binvoice\b/i,
  /\bpayment\s+(?:has\s+been\s+)?(?:processed|sent|initiated|completed)\b/i,
  /\bwire\s+transfer\b/i,
  /\bw-?9\b/i,
  /\bremit(?:tance)?\b/i,
  /\bpay(?:pal|able)\s+email\b/i,
  /\bfinal\s+payment\b/i,
  /\bbilling\s+department\b/i,
];

const GO_LIVE_PATTERNS: RegExp[] = [
  /\bgo\s+live\b/i,
  /\bpost\s+via\s+(?:campaign\s+)?link\b/i,
  /\bcampaign\s+link\b/i,
  /\bposting\s+(?:date|time|window)\b/i,
  /\bsilent\s+period\b/i,
  /\blink\s+in\s+bio\b/i,
  /\bapproved\s+(?:caption|video|thumbnail|content)\b/i,
  /\byou\s+can\s+(?:go\s+live|post|publish)\b/i,
  /\byou're\s+good\s+to\s+go\b/i,
  /\bimportant\s+steps?\s+to\s+follow\b/i,
];

const REVISION_PATTERNS: RegExp[] = [
  /\brevision/i,
  /\bfeedback\b.*\b(?:below|attached|in\s+the)\b/i,
  /\bminor\s+(?:adjustment|change|edit|update)/i,
  /\bcontent\s+review\b/i,
  /\bround\s+(?:of\s+)?(?:revision|feedback|edit|change)/i,
  /\bsend\s+(?:over|back|me)\s+(?:the\s+)?(?:revised|updated|final|new)/i,
  /\bwe\s+have\s+(?:\w+\s+)?(?:feedback|notes|changes|edits)/i,
  /\bplease\s+(?:have|make|send).*\b(?:change|edit|revision|update)/i,
  /\bupdated\s+(?:draft|version|video|content)/i,
];

const AFFILIATE_PATTERNS: RegExp[] = [
  /\bcommission\b/i,
  /\baffiliate\s+(?:link|program|partner|marketing)\b/i,
  /\breferral\s+(?:link|code|program)\b/i,
  /\bpromo\s+(?:code|link)\b/i,
  /\bcoupon\s+code\b/i,
  /\bearn\s+(?:commission|revenue|a\s+percentage|per\s+sale|per\s+order)/i,
  /\bperformance[- ]?based\b/i,
  /\bgifted\s+(?:collab|partnership|opportunity)/i,
  /\bproduct\s+(?:only|seeding|in\s+exchange)\b/i,
  /\bgifting\b/i,
  /\bbarter\b/i,
  /\bin[- ]?kind\b/i,
];

const RATE_NEGOTIATION_PATTERNS: RegExp[] = [
  /\$\s*[\d,]+(?:\.\d{2})?/,
  /\brate\b.*\b(?:breakdown|card|sheet)\b/i,
  /\bbudget\b/i,
  /\bcompensation\b/i,
  /\bcost\s+per\s+(?:post|reel|video|tiktok|story)/i,
  /\btotal\s+rate\b/i,
  /\bmeet\s+(?:somewhere|in\s+the\s+middle)\b/i,
  /\bcounter(?:offer)?\b/i,
  /\byour\s+(?:proposed\s+)?rate/i,
  /\bestimated\s+(?:total\s+)?rate/i,
  /\brate\s+(?:is|would\s+be|of)\s+\$/i,
];

const FOLLOW_UP_PATTERNS: RegExp[] = [
  /\bfollowing\s+up\b/i,
  /\bchecking\s+(?:in|on)\b/i,
  /\bany\s+update/i,
  /\bhaven'?t\s+heard\b/i,
  /\bhave\s+not\s+heard\b/i,
  /\bhas\s+(?:the\s+)?(?:brand|team|client)\s+made\s+(?:a\s+)?decision/i,
  /\bstill\s+interested\b/i,
  /\bjust\s+checking\b/i,
  /\bwanted\s+to\s+(?:follow\s+up|check\s+in|touch\s+base)/i,
  /\bget\s+back\s+to\s+me\b/i,
  /\bawaiting\s+(?:your|a)\s+response/i,
  /\blet\s+me\s+know\s+(?:if|when|whether)/i,
];

const INITIAL_OFFER_PATTERNS: RegExp[] = [
  /\binterested\s+in\s+(?:partnering|working|collaborating)\b/i,
  /\bwould\s+(?:love|like)\s+to\s+(?:partner|work|collaborat)/i,
  /\bwe'?re\s+(?:looking|seeking|interested)\b/i,
  /\binviting\s+you\b/i,
  /\bpartnership\s+(?:inquiry|invite|opportunity)\b/i,
  /\bpaid\s+(?:partnership|opportunity|campaign|collaboration)/i,
  /\bwe\s+(?:are|would)\s+(?:love|like)\s+to\s+offer/i,
  /\bsponsor(?:ing|ship)\s+(?:you|opportunity|offer)/i,
  /\bopportunity\s+to\s+(?:partner|collaborat|work)/i,
];

const DOLLAR_AMOUNT = /\$\s*([\d,]+(?:\.\d{2})?)/g;

const DELIVERABLE_PATTERNS: RegExp[] = [
  /\b(\d{1,2})\s*(?:x\s+)?tik\s*tok\s*(?:video|post)?/i,
  /\b(\d{1,2})\s*(?:x\s+)?(?:instagram|ig)\s*(?:reel|story|stories|post)/i,
  /\b(\d{1,2})\s*(?:x\s+)?youtube\s*(?:video|short)/i,
  /\b(\d{1,2})\s*(?:x\s+)?(?:reel|story|stories|post|video)/i,
  /\btiktok\s*(?:post|video)\b/i,
  /\binstagram\s*(?:reels?|stor(?:y|ies)|posts?)\b/i,
  /\byoutube\s*(?:videos?|shorts?)\b/i,
  /\burg\b/i,
];

const DEADLINE_PATTERNS: RegExp[] = [
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /\bby\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  /\bdeadline[:\s]+/i,
  /\bdue\s+(?:by|date|on)\s*/i,
  /\b(?:posting|go[\s-]live|content|draft)\s+(?:date|window|between)/i,
  /\bno\s+later\s+than\b/i,
];

const PAYMENT_TIMING_PATTERNS: RegExp[] = [
  /\bnet\s*(\d{1,3})\b/i,
  /\bwithin\s+(\d{1,3})\s+(?:days?|weeks?)/i,
  /\b(?:upon|on|after)\s+(?:approval|receipt|submission|posting|go[\s-]live|completion)/i,
  /\bpayment\s+(?:terms|schedule|timing)\b/i,
];

const EXCLUSIVITY_PATTERNS: RegExp[] = [
  /\bexclusiv(?:e|ity)\s*(?:period|window|clause|fee)?/i,
  /\bno\s+(?:competing|competitor)\s+(?:brand|product)/i,
  /\b(?:one|1)\s+week\s+(?:before|after)\b/i,
  /\bsilent\s+period\b/i,
  /\bretailer\s+exclusivity/i,
];

const USAGE_PATTERNS: RegExp[] = [
  /\busage\s+(?:rights|license|term|period|fee)/i,
  /\bwhitelist(?:ing)?\s*(?:allowed|fee|period|rights)?/i,
  /\b(?:paid\s+)?social\b/i,
  /\borganic\b.*\b(?:usage|right|post|content)/i,
  /\bcontent\s+ownership\b/i,
];

function compact(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function messageText(message: EmailMessageRecord) {
  return compact(message.textBody ?? message.htmlBody?.replace(/<[^>]+>/g, " ") ?? "");
}

function fullThreadText(messages: EmailMessageRecord[]) {
  return messages
    .map((message) => {
      const from = message.from?.email ?? "unknown";
      const direction = message.direction === "inbound" ? "brand" : "creator";
      return `[${direction}, from: ${from}]\n${messageText(message)}`;
    })
    .join("\n\n---\n\n");
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function firstSentence(text: string, maxLen = 200) {
  const cleaned = compact(text);
  const match = cleaned.match(/^(.+?)(?:[.!?]\s|$)/);
  if (!match) return cleaned.slice(0, maxLen);
  return match[1].length > maxLen ? match[1].slice(0, maxLen) : match[1].trim();
}

function lastInbound(messages: EmailMessageRecord[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "inbound") return messages[i];
  }
  return null;
}

function lastOutbound(messages: EmailMessageRecord[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "outbound") return messages[i];
  }
  return null;
}

function recentMessages(messages: EmailMessageRecord[], count: number) {
  return messages.slice(-count);
}

// fallow-ignore-next-line complexity
function detectConversationMode(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null
): ThreadConversationMode {
  const messages = thread.messages;
  if (messages.length === 0) return "low_signal_follow_up";

  const recent = recentMessages(messages, 4);
  const recentText = recent.map(messageText).join(" ").toLowerCase();
  const latestInbound = lastInbound(messages);
  const latestInboundText = latestInbound ? messageText(latestInbound).toLowerCase() : "";

  if (matchesAny(latestInboundText, UNSUBSCRIBE_PATTERNS)) {
    return "unsubscribe_or_ignore";
  }

  if (matchesAny(latestInboundText, INVOICE_PATTERNS)) {
    return "invoice_closeout";
  }

  if (matchesAny(recentText, GO_LIVE_PATTERNS)) {
    return "go_live";
  }

  if (matchesAny(recentText, REVISION_PATTERNS)) {
    const hasGoLive = matchesAny(recentText, GO_LIVE_PATTERNS);
    if (!hasGoLive) return "revision_cycle";
  }

  const hasAffiliate = matchesAny(recentText, AFFILIATE_PATTERNS);
  const hasDollar = matchesAny(recentText, RATE_NEGOTIATION_PATTERNS);

  if (hasAffiliate && !hasDollar) {
    return "decline_affiliate";
  }

  if (hasDollar) {
    return "rate_negotiation";
  }

  if (
    partnership?.deal?.status === "deliverables_pending" ||
    partnership?.deal?.status === "submitted"
  ) {
    if (matchesAny(recentText, REVISION_PATTERNS)) {
      return "revision_cycle";
    }
  }

  if (matchesAny(latestInboundText, FOLLOW_UP_PATTERNS)) {
    const earlierMessages = messages.slice(0, -1);
    const hasSubstantiveDiscussion = earlierMessages.some((m) => {
      const t = messageText(m);
      return (
        t.length > 100 &&
        (matchesAny(t, RATE_NEGOTIATION_PATTERNS) || matchesAny(t, INITIAL_OFFER_PATTERNS))
      );
    });

    if (hasSubstantiveDiscussion) {
      return "follow_up_decision";
    }

    return "low_signal_follow_up";
  }

  if (matchesAny(latestInboundText, INITIAL_OFFER_PATTERNS)) {
    return "initial_offer";
  }

  if (latestInboundText.length < 150 && !hasDollar && !hasAffiliate) {
    return "low_signal_follow_up";
  }

  if (messages.length <= 3) {
    return "initial_offer";
  }

  return "low_signal_follow_up";
}

function detectCompensationType(threadText: string): CompensationType {
  const lower = threadText.toLowerCase();
  const hasAffiliate = matchesAny(lower, AFFILIATE_PATTERNS);
  const hasDollar = /\$\s*[\d,]+/.test(lower);
  const hasPaid = /\bpaid\s+(?:partnership|opportunity|campaign|collab|deal)/i.test(lower);

  if (hasPaid && hasAffiliate) return "hybrid";
  if (hasPaid || hasDollar) return "guaranteed_paid";
  if (hasAffiliate) {
    if (/\bgifted\b|\bgifting\b|\bproduct\s+only\b/i.test(lower)) return "gifted";
    return "affiliate";
  }
  return "unclear";
}

function determineNextMoveOwner(
  thread: EmailThreadDetail,
  mode: ThreadConversationMode
): NextMoveOwner {
  if (mode === "unsubscribe_or_ignore") return "none";
  if (mode === "low_signal_follow_up") return "none";

  const messages = thread.messages;
  if (messages.length === 0) return "none";

  const last = messages[messages.length - 1];

  if (last.direction === "inbound") {
    return "creator";
  }

  if (mode === "go_live") return "creator";
  if (mode === "revision_cycle") return "brand";
  if (mode === "invoice_closeout") {
    const text = messageText(last).toLowerCase();
    if (/please\s+(?:send|submit|share)/i.test(text)) return "creator";
    return "brand";
  }

  return "brand";
}

function extractLatestInboundAsk(thread: EmailThreadDetail): string | null {
  const latest = lastInbound(thread.messages);
  if (!latest) return null;
  return firstSentence(messageText(latest), 300) || null;
}

function extractLastCreatorPosition(thread: EmailThreadDetail): string | null {
  const last = lastOutbound(thread.messages);
  if (!last) return null;
  return firstSentence(messageText(last), 300) || null;
}

function extractCompensation(threadText: string): string | null {
  const amounts: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(DOLLAR_AMOUNT.source, "gi");

  while ((match = regex.exec(threadText)) !== null) {
    amounts.push(match[1].replace(/,/g, ""));
  }

  const uniqueAmounts = [...new Set(amounts)];
  if (uniqueAmounts.length === 0) {
    if (/commission/i.test(threadText)) return "Commission-based (no guaranteed amount)";
    if (/gifted|product\s+only|gifting/i.test(threadText))
      return "Product/gifted only (no cash compensation)";
    return null;
  }

  const nums = uniqueAmounts.map(Number).filter((n) => !isNaN(n) && n > 0);
  if (nums.length === 0) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);

  if (min === max) return `$${min.toLocaleString()}`;
  return `$${min.toLocaleString()} - $${max.toLocaleString()} range discussed`;
}

function extractDeliverables(threadText: string): string | null {
  const found: string[] = [];
  const seen = new Set<string>();

  for (const pattern of DELIVERABLE_PATTERNS) {
    const match = pattern.exec(threadText);
    if (match) {
      const text = match[0].trim();
      const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!seen.has(normalized)) {
        seen.add(normalized);
        found.push(text);
      }
    }
  }

  if (found.length === 0) return null;
  return found.join(", ");
}

function extractDeadlines(threadText: string): string | null {
  const found: string[] = [];
  const seen = new Set<string>();

  for (const pattern of DEADLINE_PATTERNS) {
    const match = pattern.exec(threadText);
    if (match) {
      const text = match[0].trim();
      const normalized = text.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        found.push(text);
      }
    }
  }

  if (found.length === 0) return null;
  return [...new Set(found)].join("; ");
}

function extractUsageTerms(threadText: string): string | null {
  const parts: string[] = [];

  for (const pattern of USAGE_PATTERNS) {
    if (pattern.test(threadText)) {
      const match = pattern.exec(threadText);
      if (match) parts.push(match[0].trim());
    }
  }

  if (/whitelist/i.test(threadText)) parts.push("Whitelisting mentioned");
  if (/organic/i.test(threadText)) parts.push("Organic usage");
  if (/paid\s+social/i.test(threadText)) parts.push("Paid social");
  if (/exclusiv/i.test(threadText)) parts.push("Exclusivity discussed");

  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(", ") : null;
}

function extractExclusivityTerms(threadText: string): string | null {
  for (const pattern of EXCLUSIVITY_PATTERNS) {
    const match = pattern.exec(threadText);
    if (match) return match[0].trim();
  }
  return null;
}

function extractPaymentTiming(threadText: string): string | null {
  for (const pattern of PAYMENT_TIMING_PATTERNS) {
    const match = pattern.exec(threadText);
    if (match) return match[0].trim();
  }
  return null;
}

function extractOpenQuestions(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null
): string[] {
  const questions: string[] = [];
  const latest = lastInbound(thread.messages);
  if (!latest) return questions;

  const text = messageText(latest);

  const questionMatches = text.match(
    /(?:can|could|would|will|do|does|is|are|has|have)\s+you[^?.]*\?/gi
  );
  if (questionMatches) {
    questions.push(...questionMatches.map((q) => q.trim()).slice(0, 3));
  }

  const terms = partnership?.terms;
  if (terms) {
    if (!terms.paymentAmount && !/\$\s*[\d,]+/.test(text)) {
      questions.push("Compensation amount not yet agreed");
    }
    if (terms.deliverables.length === 0) {
      questions.push("Deliverables not yet specified");
    }
  }

  return [...new Set(questions)].slice(0, 5);
}

// fallow-ignore-next-line complexity
function extractRisks(
  threadText: string,
  partnership: DealAggregate | null,
  compensationType: CompensationType
): string[] {
  const risks: string[] = [];

  if (compensationType === "affiliate") {
    risks.push("Offer is commission/affiliate based, not guaranteed pay");
  }
  if (compensationType === "gifted") {
    risks.push("Offer is product/gifted only, no cash compensation");
  }
  if (compensationType === "hybrid") {
    risks.push("Offer mixes guaranteed and performance-based compensation");
  }

  const lower = threadText.toLowerCase();

  if (/\b(?:perpetual|forever|unlimited|indefinite)\s+(?:usage|license|rights)/i.test(lower)) {
    risks.push("Perpetual or unlimited usage rights requested");
  }
  if (/\bexclusive|exclusivity\b/i.test(lower) && !/\bnon[- ]?exclusive/i.test(lower)) {
    if (compensationType !== "guaranteed_paid") {
      risks.push("Exclusivity requested without guaranteed compensation");
    }
  }
  if (/\basap|urgent|right away|immediately|today\b/i.test(lower)) {
    risks.push("Rushed timeline may pressure quick decision");
  }

  if (partnership?.terms) {
    const terms = partnership.terms;
    if (terms.exclusivityApplies && !terms.exclusivityDuration) {
      risks.push("Exclusivity applies but duration is unspecified");
    }
    if (terms.netTermsDays && terms.netTermsDays > 60) {
      risks.push(`Long payment window: Net ${terms.netTermsDays}`);
    }
  }

  return risks;
}

function assessSpamConfidence(
  thread: EmailThreadDetail,
  threadText: string
): "none" | "low" | "medium" | "high" {
  const messages = thread.messages;
  const inboundMessages = messages.filter((m) => m.direction === "inbound");

  if (inboundMessages.length === 0) return "none";

  const latestInbound = lastInbound(messages);
  if (!latestInbound) return "none";

  const latestText = messageText(latestInbound);
  const lower = latestText.toLowerCase();

  if (matchesAny(lower, UNSUBSCRIBE_PATTERNS)) return "none";

  let score = 0;

  const veryShort = latestText.length < 80;
  const noTerms = !/\$|rate|budget|compensation|deliverable|deadline|timeline/i.test(lower);
  const noBrandDetails = !/\b(?:campaign|partnership|collaboration|sponsor|brand)\b/i.test(lower);
  const isGenericFollowUp =
    /\bhaven'?t\s+heard\b|\bawaiting\s+response\b|\bget\s+back\s+to\s+me\b/i.test(lower);
  const isRepetitive =
    inboundMessages.length >= 2 &&
    inboundMessages.every((m) => {
      const t = messageText(m).slice(0, 60);
      return t === messageText(inboundMessages[0]).slice(0, 60);
    });

  if (veryShort && noTerms) score += 2;
  if (noBrandDetails && noTerms) score += 1;
  if (isGenericFollowUp && noTerms) score += 2;
  if (isRepetitive) score += 3;

  if (score >= 4) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "none";
}

function determineThreadPhase(thread: EmailThreadDetail): "early" | "mid" | "late" {
  const count = thread.messages.length;
  if (count <= 3) return "early";
  if (count <= 8) return "mid";
  return "late";
}

export function buildThreadBrief(
  thread: EmailThreadDetail,
  partnership: DealAggregate | null
): ThreadBrief {
  const threadText = fullThreadText(thread.messages);
  const rawText = thread.messages.map(messageText).join(" ");

  const mode = detectConversationMode(thread, partnership);
  const compensationType = detectCompensationType(rawText);
  const nextMoveOwner = determineNextMoveOwner(thread, mode);
  const threadPhase = determineThreadPhase(thread);
  const spamConfidence = assessSpamConfidence(thread, rawText);

  const brandName = partnership?.deal?.brandName ?? thread.primaryLink?.brandName ?? null;

  return {
    mode,
    compensationType,
    latestInboundAsk: extractLatestInboundAsk(thread),
    lastCreatorPosition: extractLastCreatorPosition(thread),
    nextMoveOwner,
    activeTerms: {
      compensation: extractCompensation(rawText),
      deliverables: extractDeliverables(rawText),
      deadlines: extractDeadlines(rawText),
      usageRights: extractUsageTerms(rawText),
      exclusivity: extractExclusivityTerms(rawText),
      paymentTiming: extractPaymentTiming(rawText),
    },
    openQuestions: extractOpenQuestions(thread, partnership),
    blockers: [],
    risks: extractRisks(rawText, partnership, compensationType),
    spamConfidence,
    brandName,
    threadPhase,
  };
}

// fallow-ignore-next-line complexity
export function threadBriefForPrompt(brief: ThreadBrief): string {
  const lines: string[] = [
    `Conversation mode: ${brief.mode}`,
    `Compensation type: ${brief.compensationType}`,
    `Thread phase: ${brief.threadPhase}`,
    `Next move: ${brief.nextMoveOwner === "creator" ? "creator needs to respond" : brief.nextMoveOwner === "brand" ? "waiting on brand" : "no action needed"}`,
  ];

  if (brief.brandName) lines.push(`Brand: ${brief.brandName}`);
  if (brief.latestInboundAsk) lines.push(`Latest inbound ask: ${brief.latestInboundAsk}`);
  if (brief.lastCreatorPosition) lines.push(`Last creator position: ${brief.lastCreatorPosition}`);
  if (brief.spamConfidence !== "none")
    lines.push(`Spam/low-signal confidence: ${brief.spamConfidence}`);

  const terms = brief.activeTerms;
  const activeTermLines: string[] = [];
  if (terms.compensation) activeTermLines.push(`Compensation: ${terms.compensation}`);
  if (terms.deliverables) activeTermLines.push(`Deliverables: ${terms.deliverables}`);
  if (terms.deadlines) activeTermLines.push(`Deadlines: ${terms.deadlines}`);
  if (terms.usageRights) activeTermLines.push(`Usage: ${terms.usageRights}`);
  if (terms.exclusivity) activeTermLines.push(`Exclusivity: ${terms.exclusivity}`);
  if (terms.paymentTiming) activeTermLines.push(`Payment timing: ${terms.paymentTiming}`);

  if (activeTermLines.length > 0) {
    lines.push("", "Active terms from thread:");
    lines.push(...activeTermLines.map((l) => `- ${l}`));
  }

  if (brief.openQuestions.length > 0) {
    lines.push("", "Open questions:");
    lines.push(...brief.openQuestions.map((q) => `- ${q}`));
  }

  if (brief.risks.length > 0) {
    lines.push("", "Risks:");
    lines.push(...brief.risks.map((r) => `- ${r}`));
  }

  return lines.join("\n");
}

const MODE_DRAFT_GUIDANCE: Record<ThreadConversationMode, string> = {
  decline_affiliate:
    "This thread involves a commission, affiliate, or gifted offer that may be presented as a paid deal. " +
    "Do not accept commission-only, affiliate, or product-gifting arrangements as if they were guaranteed paid deals. " +
    "If the creator wants guaranteed compensation, decline the affiliate structure and explicitly ask for a flat fee. " +
    "If no guaranteed pay is on the table, keep the reply brief and professional without over-engaging.",

  rate_negotiation:
    "This thread is in active rate negotiation. " +
    "Track the negotiation anchor (the last rate or counteroffer on the table) and avoid resetting or contradicting it. " +
    "Reference the most recent numbers mentioned. " +
    "If the creator sent a rate and the brand has not responded, follow up professionally without undercutting. " +
    "If the brand sent a counteroffer, address it directly without ignoring the specific number.",

  go_live:
    "This thread is in execution or go-live mode. Content has been approved and the creator needs to post or has just posted. " +
    "Focus on operational details: confirm posting date and time, acknowledge campaign links, caption requirements, " +
    "ad codes, hashtags, bio links, silent period rules, and deadlines. " +
    "Do not negotiate terms in this phase. If there are outstanding go-live requirements, address them directly.",

  invoice_closeout:
    "This thread is in payment or invoice closeout mode. " +
    "Focus on invoice details, payment timing, billing contacts, W-9 requests, PayPal or bank details, and payment confirmation. " +
    "If the brand owes payment, reference the agreed amount and terms. " +
    "If the creator needs to send an invoice, provide the information requested.",

  revision_cycle:
    "This thread is in a content revision cycle. " +
    "Address the specific feedback or revision notes from the brand. Confirm which changes were made and offer a revised version. " +
    "If the revision deadline is approaching, acknowledge it. " +
    "Do not reopen negotiations on rate or scope during the revision cycle.",

  follow_up_decision:
    "This thread involves a follow-up where one side is waiting on a decision from the other. " +
    "Draft a professional follow-up that is direct but not desperate. " +
    "Reference the specific decision or update being requested without repeating the entire history.",

  initial_offer:
    "This thread is a new brand outreach or initial offer. " +
    "Respond professionally. If rate information is requested, provide a clear rate breakdown. " +
    "If the brand has not shared enough detail about deliverables, timeline, or compensation, ask focused clarifying questions. " +
    "Do not overcommit or accept vague terms.",

  unsubscribe_or_ignore:
    "The creator has asked to be removed from outreach or is clearly not interested. " +
    "Draft a firm but professional message requesting removal from future outreach. " +
    "Keep it short and direct. Do not engage with the offer terms.",

  low_signal_follow_up:
    "This thread appears to be a low-signal or generic follow-up with no concrete deal terms, compensation, or actionable asks. " +
    "Suggest a short, non-committal reply or recommend ignoring the thread. " +
    "Do not draft an eager or detailed response to what is likely cold outreach or a mass follow-up.",
};

export function modeSpecificDraftGuidance(
  mode: ThreadConversationMode,
  brief: ThreadBrief
): string {
  const base = MODE_DRAFT_GUIDANCE[mode];

  const extras: string[] = [];
  if (brief.compensationType === "affiliate" || brief.compensationType === "gifted") {
    if (mode !== "decline_affiliate") {
      extras.push(
        "Note: This offer involves affiliate or gifted compensation, not guaranteed pay. Treat accordingly."
      );
    }
  }

  if (brief.activeTerms.compensation) {
    extras.push(
      `Compensation referenced in thread: ${brief.activeTerms.compensation}. Preserve this in the draft.`
    );
  }

  if (brief.nextMoveOwner === "creator") {
    extras.push("The creator needs to respond to move this forward.");
  } else if (brief.nextMoveOwner === "brand") {
    extras.push(
      "The brand owes the next response. The draft should follow up, not volunteer new concessions."
    );
  }

  return [base, ...extras].join("\n\n");
}

const MODE_SUMMARY_GUIDANCE: Record<ThreadConversationMode, string> = {
  decline_affiliate:
    "Identify the compensation structure as affiliate, commission, or gifted, not guaranteed pay. " +
    "State whether the creator has responded or this is still pending.",

  rate_negotiation:
    "Focus on what rates have been proposed, by whom, and what the current anchor number is. " +
    "State who last made an offer and whether a decision is still pending.",

  go_live:
    "Focus on the current execution status: posting date, approved content, campaign links, captions, and any outstanding requirements. " +
    "State whether the creator has posted or is about to post.",

  invoice_closeout:
    "Focus on payment status, invoice details, payment timing, and whether payment has been sent or received. " +
    "State the agreed amount and any outstanding billing items.",

  revision_cycle:
    "Focus on the current revision status: what feedback was given, what changes were made, " +
    "and whether the brand has approved the latest version.",

  follow_up_decision:
    "Focus on what decision is pending, who is waiting, and how long it has been since the last substantive response.",

  initial_offer:
    "Focus on what the brand is offering, what deliverables they want, what they are asking the creator to provide, " +
    "and whether the creator has responded.",

  unsubscribe_or_ignore:
    "State that the creator has requested removal or is clearly not interested in this outreach.",

  low_signal_follow_up:
    "State that this is a generic or low-signal follow-up with no concrete deal terms or actionable asks. " +
    "Recommend whether to respond or ignore.",
};

export function modeSpecificSummaryGuidance(mode: ThreadConversationMode): string {
  return MODE_SUMMARY_GUIDANCE[mode];
}

export function modeSpecificFallbackDraft(
  thread: EmailThreadDetail,
  brief: ThreadBrief,
  profile: ProfileRecord,
  partnership: DealAggregate | null,
  currentDraft?: { subject: string; body: string } | null
): { subject: string; body: string } {
  const signoff = profile.preferredSignature?.trim() || profile.displayName?.trim() || "Creator";
  const baseSubject = currentDraft?.subject?.trim();
  const subject =
    baseSubject ||
    (thread.thread.subject.startsWith("Re:")
      ? thread.thread.subject
      : `Re: ${thread.thread.subject}`);

  if (currentDraft?.body?.trim()) {
    return { subject, body: currentDraft.body.trim() };
  }

  switch (brief.mode) {
    case "decline_affiliate": {
      return {
        subject,
        body:
          `Thank you for reaching out. At this time, I only accept partnerships with guaranteed flat-fee compensation. ` +
          `If you have a paid opportunity with a set budget, I would be happy to discuss it.\n\nBest,\n${signoff}`,
      };
    }

    case "unsubscribe_or_ignore": {
      return {
        subject,
        body:
          `Thank you for reaching out. I am not interested in this opportunity and would appreciate being removed from your outreach list. ` +
          `Thank you for understanding.\n\nBest,\n${signoff}`,
      };
    }

    case "low_signal_follow_up": {
      if (brief.spamConfidence === "high" || brief.spamConfidence === "medium") {
        return {
          subject,
          body:
            `Thank you for following up. I have reviewed the opportunity and it is not the right fit for me at this time. ` +
            `I appreciate you thinking of me.\n\nBest,\n${signoff}`,
        };
      }
      return {
        subject,
        body: `Thanks for following up. I am still reviewing the details and will get back to you soon.\n\nBest,\n${signoff}`,
      };
    }

    case "go_live": {
      return {
        subject,
        body:
          `Got it, thank you for the go-live details. I will make sure to follow all posting instructions and meet the deadline. ` +
          `I will confirm once the post is live.\n\nBest,\n${signoff}`,
      };
    }

    case "invoice_closeout": {
      return {
        subject,
        body: `Thank you for the payment update. Please let me know if you need any additional information from my end to process this.\n\nBest,\n${signoff}`,
      };
    }

    case "revision_cycle": {
      return {
        subject,
        body: `I have reviewed the feedback and will send over the revised version shortly.\n\nBest,\n${signoff}`,
      };
    }

    case "rate_negotiation": {
      const intro = partnership
        ? `Thanks for the update on ${partnership.deal.campaignName}.`
        : "Thanks for your message.";
      return {
        subject,
        body:
          `${intro}\n\nI have reviewed the details and I am aligned on the next steps. ` +
          `Please let me know if there are any updates on timing or terms.\n\nBest,\n${signoff}`,
      };
    }

    case "follow_up_decision": {
      return {
        subject,
        body:
          `Hi, I wanted to follow up on our previous conversation. ` +
          `Please let me know if there are any updates or if you need additional information from my end.\n\nBest,\n${signoff}`,
      };
    }

    default: {
      const intro = partnership
        ? `Thanks for the note on ${partnership.deal.campaignName}.`
        : "Thanks for the note.";
      return {
        subject,
        body:
          `${intro}\n\nI reviewed the thread and I am aligned on the next steps. ` +
          `If there are any updates on timing, deliverables, or contract details, send them over and I will keep things moving.\n\nBest,\n${signoff}`,
      };
    }
  }
}

export function modeSpecificSuggestions(
  mode: ThreadConversationMode,
  brief: ThreadBrief
): Array<{ label: string; prompt: string }> {
  switch (mode) {
    case "decline_affiliate":
      return [
        {
          label: "Decline and request flat-fee terms",
          prompt:
            "Politely decline the affiliate or commission arrangement and ask if they have a guaranteed flat-fee budget.",
        },
        {
          label: "Ask for full compensation details",
          prompt:
            "Ask the brand to clarify the exact compensation structure, including whether there is any guaranteed payment.",
        },
        {
          label: "Send a short decline",
          prompt: "Write a brief, professional decline without over-explaining.",
        },
      ];

    case "rate_negotiation": {
      const suggestions: Array<{ label: string; prompt: string }> = [];
      if (brief.nextMoveOwner === "brand") {
        suggestions.push(
          {
            label: "Follow up on your rate",
            prompt:
              "Follow up on the rate you proposed. Restate your value without undercutting your number.",
          },
          {
            label: "Suggest a compromise",
            prompt: "Propose a middle-ground rate or adjusted scope to bridge the gap.",
          },
          {
            label: "Hold firm on your rate",
            prompt:
              "Reaffirm your rate with confidence. Reference your engagement, audience fit, or content quality as justification.",
          }
        );
      } else {
        suggestions.push(
          {
            label: "Send your rate breakdown",
            prompt:
              "Provide a clear rate breakdown by deliverable. Include exclusivity and cross-posting fees if relevant.",
          },
          {
            label: "Ask for their budget range",
            prompt:
              "Ask the brand to share their budget or rate range before committing to a number.",
          },
          {
            label: "Counter with adjusted scope",
            prompt:
              "If their budget is tight, suggest reducing deliverables or exclusivity to meet their budget.",
          }
        );
      }
      return suggestions;
    }

    case "go_live":
      return [
        {
          label: "Confirm go-live timing",
          prompt:
            "Confirm the posting date, time, and that all go-live requirements are understood and will be met.",
        },
        {
          label: "Ask for clarification on posting requirements",
          prompt:
            "Ask about any unclear posting instructions, campaign links, caption requirements, or hashtags.",
        },
        {
          label: "Confirm post is live",
          prompt:
            "Write a short message confirming the content has been posted with any required links or metrics.",
        },
      ];

    case "invoice_closeout":
      return [
        {
          label: "Send invoice details",
          prompt:
            "Provide the requested invoice or payment details including amount, payment terms, and contact information.",
        },
        {
          label: "Follow up on payment status",
          prompt:
            "Politely follow up on the payment timeline and confirm when payment is expected.",
        },
        {
          label: "Confirm payment received",
          prompt: "Confirm that payment has been received and thank them for the partnership.",
        },
      ];

    case "revision_cycle":
      return [
        {
          label: "Confirm revisions are done",
          prompt:
            "Confirm that all requested revisions have been made and share the updated content.",
        },
        {
          label: "Ask for clarification on feedback",
          prompt: "Ask for more specific direction on the revision notes that are unclear.",
        },
        {
          label: "Flag a revision deadline issue",
          prompt: "Address any concerns about the revision timeline and negotiate if needed.",
        },
      ];

    case "follow_up_decision":
      return [
        {
          label: "Follow up on the pending decision",
          prompt: "Write a professional follow-up asking whether a decision has been made.",
        },
        {
          label: "Offer additional information",
          prompt:
            "Offer to provide any additional information the brand may need to make their decision.",
        },
        {
          label: "Set a deadline to hear back",
          prompt:
            "Let the brand know you need a decision by a specific date to hold the collaboration window.",
        },
      ];

    case "initial_offer":
      return [
        {
          label: "Express interest and share rates",
          prompt:
            "Express interest in the opportunity and share your rate card or proposed rate breakdown.",
        },
        {
          label: "Ask for more campaign details",
          prompt:
            "Ask for specifics on deliverables, timeline, usage rights, and compensation before committing.",
        },
        {
          label: "Decline if not a fit",
          prompt:
            "Politely decline the opportunity if it is not aligned with your current priorities.",
        },
      ];

    case "unsubscribe_or_ignore":
      return [
        {
          label: "Request removal from outreach",
          prompt: "Firmly request removal from their outreach or mailing list.",
        },
        {
          label: "Decline and set boundaries",
          prompt: "Decline the offer and ask not to be contacted again for similar opportunities.",
        },
        {
          label: "Ignore this thread",
          prompt: "Recommend ignoring this thread entirely. No response is needed.",
        },
      ];

    case "low_signal_follow_up":
      return [
        {
          label: "Send a short decline",
          prompt: "Write a brief, polite decline. Keep it to one or two sentences.",
        },
        {
          label: "Ignore this thread",
          prompt:
            "Recommend ignoring this thread. It is a low-signal follow-up with no actionable terms.",
        },
        {
          label: "Ask what the opportunity is",
          prompt:
            "Ask the sender to provide specific details about the deal, including compensation and deliverables.",
        },
      ];

    default:
      return [
        {
          label: "Confirm the next steps",
          prompt: "Confirm the next steps and any pending action items.",
        },
        {
          label: "Ask for clarification",
          prompt: "Ask for clarification on any unclear terms or requirements.",
        },
        {
          label: "Keep it short and confirm availability",
          prompt:
            "Write a brief reply confirming availability and interest without overcommitting.",
        },
      ];
  }
}
