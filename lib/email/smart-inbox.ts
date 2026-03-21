import type {
  DealAggregate,
  DealTermsRecord,
  EmailDealEventCategory,
  EmailMessageRecord,
  EmailThreadDetail,
  EmailThreadListItem,
  PendingExtractionData
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

function textForMessage(message: EmailMessageRecord) {
  return compactText([
    message.subject,
    message.textBody ?? "",
    ...message.attachments.map((attachment) => attachment.filename),
    ...message.attachments.map((attachment) => attachment.extractedText ?? "")
  ].join("\n")).toLowerCase();
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
    { category: "timeline", pattern: /\b(due|deadline|schedule|reschedule|tomorrow|friday|monday|date|calendar)\b/i, title: "Timeline or scheduling update" },
    { category: "deliverable", pattern: /\b(deliverable|draft|final|revision|reel|story|post|video|ugc)\b/i, title: "Deliverable-related update" },
    { category: "approval", pattern: /\b(approve|approved|approval|looks good|accepted|reject|rejected|declined)\b/i, title: "Approval status update" },
    { category: "rights", pattern: /\b(usage|rights|whitelist|whitelisting|exclusiv|organic|paid social|license|term|territory)\b/i, title: "Usage rights or exclusivity update" },
    { category: "ask", pattern: /\b(can you|could you|please|need you|let me know|confirm|send over|share)\b/i, title: "Action requested from the creator" }
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
  const text = textForMessage(message);
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
