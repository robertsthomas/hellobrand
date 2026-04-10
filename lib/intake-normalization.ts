import type {
  CampaignDateWindow,
  DealCategory,
  DealAggregate,
  DeliverableItem,
  DisclosureObligation,
  DocumentKind,
  ExtractionEvidenceRecord,
  IntakeAnalyticsRecord,
  IntakeEvidenceGroup,
  IntakePrimaryContact,
  IntakeTimelineItem,
  NormalizedIntakeRecord,
  SummaryRecord
} from "@/lib/types";
import { stripInlineMarkdown, toPlainDealSummary } from "@/lib/deal-summary";
import { sanitizeCampaignName, sanitizePartyName } from "@/lib/party-labels";
import {
  cleanWorkspaceFileName,
  deriveWorkspaceTitleFromFileNames,
  isGenericWorkspaceLabel
} from "@/lib/workspace-labels";

export const INTAKE_NORMALIZED_VERSION = "intake-normalized:v2";

interface PersistedIntakeRecord {
  brandName: string | null;
  agencyName: string | null;
  primaryContact: IntakePrimaryContact;
  contractTitle: string | null;
  contractSummary: string | null;
  paymentAmount: number | null;
  currency: string | null;
  deliverables: DeliverableItem[];
  timelineItems: IntakeTimelineItem[];
  brandCategory: DealCategory | null;
  competitorCategories: string[];
  restrictedCategories: string[];
  campaignDateWindow: CampaignDateWindow | null;
  disclosureObligations: DisclosureObligation[];
  analytics: IntakeAnalyticsRecord | null;
  notes: string | null;
}

interface IntakeNormalizationOptions {
  excludedPrimaryContactEmails?: Array<string | null | undefined>;
  excludedPrimaryContactNames?: Array<string | null | undefined>;
}

function presentText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return null;
  }

  if (
    /^untitled\b/i.test(trimmed) ||
    /^(name|n\/a|none|null|not specified|not found|unknown)$/i.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

function normalizeLabelText(value: string | null | undefined) {
  const normalized = presentText(stripInlineMarkdown(value ?? ""));
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(
      /\b(brand name|campaign|client name|agency name|creator name|talent manager\/agency name|referred as talent manager\/agency)\b[:\s-]*/gi,
      ""
    )
    .replace(/\(if any\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitLabelSegments(value: string | null | undefined) {
  const raw = presentText(value);
  if (!raw) {
    return [] as string[];
  }

  return raw
    .split(/\s+#{1,6}\s+|\n\s*#{1,6}\s*|\n{2,}/g)
    .map((segment) => normalizeLabelText(segment))
    .filter((segment): segment is string => Boolean(segment));
}

function cleanExtractedLabel(value: string | null | undefined) {
  return splitLabelSegments(value)[0] ?? null;
}

function cleanFileName(fileName: string) {
  return (
    cleanWorkspaceFileName(fileName)
      ?.replace(/\s+x\s+/gi, " x ")
      .trim() ?? ""
  );
}

function isGenericIntakeLabel(value: string | null | undefined) {
  const normalized = presentText(value)?.toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    sanitizeCampaignName(normalized) === null ||
    isGenericWorkspaceLabel(normalized) ||
    /addendum$/i.test(normalized) ||
    normalized === "pasted email thread" ||
    normalized === "pasted deliverables notes" ||
    normalized === "pasted invoice" ||
    normalized === "pasted contract" ||
    normalized === "pasted campaign brief" ||
    normalized === "pasted context" ||
    normalized === "email thread" ||
    normalized === "campaign brief" ||
    normalized === "campaign" ||
    normalized === "project" ||
    normalized === "workspace" ||
    normalized === "overview" ||
    normalized === "concept" ||
    normalized === "contract" ||
    normalized === "context" ||
    normalized === "influencer" ||
    normalized === "creator" ||
    normalized === "content creator" ||
    normalized === "talent" ||
    normalized === "partnership"
  );
}

function lineScore(kind: DocumentKind) {
  switch (kind) {
    case "contract":
      return 4;
    case "email_thread":
      return 3;
    case "campaign_brief":
    case "deliverables_brief":
      return 2;
    case "pitch_deck":
      return 1;
    default:
      return 0;
  }
}

function parsePersistedIntakeRecord(record: SummaryRecord | null): PersistedIntakeRecord | null {
  if (!record || record.version !== INTAKE_NORMALIZED_VERSION) {
    return null;
  }

  try {
    return JSON.parse(record.body) as PersistedIntakeRecord;
  } catch {
    return null;
  }
}

function getPersistedIntakeRecord(
  summaries: SummaryRecord[]
): PersistedIntakeRecord | null {
  return parsePersistedIntakeRecord(
    summaries.find((entry) => entry.version === INTAKE_NORMALIZED_VERSION) ?? null
  );
}

function bestEvidenceSnippet(
  entries: ExtractionEvidenceRecord[],
  fieldPaths: string[]
) {
  return (
    entries.find((entry) => fieldPaths.includes(entry.fieldPath) && presentText(entry.snippet))
      ?.snippet ?? null
  );
}

function extractEmails(text: string) {
  return Array.from(
    new Set(
      Array.from(
        text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
        (match) => match[0].trim()
      )
    )
  );
}

function normalizeEmail(value: string | null | undefined) {
  return presentText(value)?.toLowerCase() ?? null;
}

function extractPhones(text: string) {
  return Array.from(
    new Set(
      Array.from(
        text.matchAll(
          /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g
        ),
        (match) => match[0].trim()
      )
    )
  );
}

function buildExcludedContactEmails(options: IntakeNormalizationOptions | undefined) {
  return new Set(
    (options?.excludedPrimaryContactEmails ?? [])
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => Boolean(email))
  );
}

function normalizeContactName(value: string | null | undefined) {
  return presentText(value)?.toLowerCase() ?? null;
}

function buildExcludedContactNames(options: IntakeNormalizationOptions | undefined) {
  return new Set(
    (options?.excludedPrimaryContactNames ?? [])
      .map((name) => normalizeContactName(name))
      .filter((name): name is string => Boolean(name))
  );
}

function isExcludedContactEmail(email: string | null | undefined, excludedEmails: Set<string>) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && excludedEmails.has(normalized));
}

function isExcludedContactName(name: string | null | undefined, excludedNames: Set<string>) {
  const normalized = normalizeContactName(name);
  return Boolean(normalized && excludedNames.has(normalized));
}

function scoreContactLine(line: string) {
  const lower = line.toLowerCase();
  let score = 0;
  if (/manager|director|partnership|campaign|media|marketing|talent|agent|coordinator/.test(lower)) {
    score += 2;
  }
  if (/\b(from|best|regards|thanks|warm regards)\b/.test(lower)) {
    score += 1;
  }
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3}$/.test(line.trim())) {
    score += 3;
  }
  return score;
}

function sanitizeContactName(value: string | null | undefined) {
  const normalized = presentText(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (
    /\b(manager|director|lead|specialist|executive|strategist|partnerships?|campaign|marketing|media|talent|agent|coordinator|producer|contact|email|phone|agency|brand|team)\b/.test(
      lower
    )
  ) {
    return null;
  }

  if (!/^[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function sanitizeContactTitle(value: string | null | undefined) {
  const normalized = presentText(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  if (
    /^[•*#\-\d(]/.test(normalized) ||
    normalized.length > 80 ||
    /[.!?]/.test(normalized) ||
    /\b(children?|device|devices|marketing|campaign manager for clarity|alexa|amazon kids\+|under 13|you will|please|should|must|will be|if for any reason|ensure|show|content|story|device name)\b/i.test(
      normalized
    )
  ) {
    return null;
  }

  if (
    !/\b(manager|director|partnership|campaign|media|marketing|talent|agent|coordinator|producer|lead|specialist|executive|strategist)\b/i.test(
      lower
    )
  ) {
    return null;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) {
    return null;
  }

  return normalized;
}

function emptyPrimaryContact(agencyName: string | null, brandName: string | null): IntakePrimaryContact {
  return {
    organizationType: agencyName ? "agency" : brandName ? "brand" : null,
    name: null,
    title: null,
    email: null,
    phone: null
  };
}

function cleanContactCandidate(
  contact: IntakePrimaryContact,
  excludedEmails: Set<string>,
  excludedNames: Set<string>
) {
  if (
    isExcludedContactEmail(contact.email, excludedEmails) ||
    isExcludedContactName(contact.name, excludedNames)
  ) {
    return null;
  }

  const name = sanitizeContactName(contact.name);
  const title = sanitizeContactTitle(contact.title);
  const email = presentText(contact.email);
  const phone = presentText(contact.phone);
  if (!name && !email && !phone) {
    return null;
  }

  return {
    organizationType: contact.organizationType,
    name,
    title,
    email,
    phone
  } satisfies IntakePrimaryContact;
}

function contactFromBriefData(
  aggregate: DealAggregate,
  agencyName: string | null,
  brandName: string | null,
  excludedEmails: Set<string>,
  excludedNames: Set<string>
) {
  const briefData = aggregate.terms?.briefData;
  if (!briefData) {
    return null;
  }

  const agencyContact = cleanContactCandidate(
    {
      organizationType: "agency",
      name: briefData.agencyContactName ?? null,
      title: briefData.agencyContactTitle ?? null,
      email: briefData.agencyContactEmail ?? null,
      phone: briefData.agencyContactPhone ?? null
    },
    excludedEmails,
    excludedNames
  );
  if (agencyContact) {
    return agencyContact;
  }

  const brandContact = cleanContactCandidate(
    {
      organizationType: "brand",
      name: briefData.brandContactName ?? null,
      title: briefData.brandContactTitle ?? null,
      email: briefData.brandContactEmail ?? null,
      phone: briefData.brandContactPhone ?? null
    },
    excludedEmails,
    excludedNames
  );
  if (brandContact) {
    return brandContact;
  }

  const linksAndAssets = (briefData.linksAndAssets ?? []).join("\n");
  const linkEmail = extractEmails(linksAndAssets).find(
    (email) => !isExcludedContactEmail(email, excludedEmails)
  );
  const linkPhone = extractPhones(linksAndAssets)[0] ?? null;
  return cleanContactCandidate(
    {
      organizationType: agencyName ? "agency" : brandName ? "brand" : null,
      name: null,
      title: null,
      email: linkEmail ?? null,
      phone: linkPhone
    },
    excludedEmails,
    excludedNames
  );
}

function contactFromExtractionEvidence(
  aggregate: DealAggregate,
  agencyName: string | null,
  brandName: string | null,
  excludedEmails: Set<string>,
  excludedNames: Set<string>
) {
  const emailSnippet = bestEvidenceSnippet(aggregate.extractionEvidence, [
    "primaryContact.email",
    "briefData.agencyContactEmail",
    "briefData.brandContactEmail"
  ]);
  const nameSnippet = bestEvidenceSnippet(aggregate.extractionEvidence, [
    "primaryContact.name",
    "briefData.agencyContactName",
    "briefData.brandContactName"
  ]);
  const titleSnippet = bestEvidenceSnippet(aggregate.extractionEvidence, [
    "primaryContact.title",
    "briefData.agencyContactTitle",
    "briefData.brandContactTitle"
  ]);
  const phoneSnippet = bestEvidenceSnippet(aggregate.extractionEvidence, [
    "primaryContact.phone",
    "briefData.agencyContactPhone",
    "briefData.brandContactPhone"
  ]);
  const email = extractEmails(emailSnippet ?? "")[0] ?? emailSnippet;
  const phone = extractPhones(phoneSnippet ?? "")[0] ?? phoneSnippet;

  return cleanContactCandidate(
    {
      organizationType: agencyName ? "agency" : brandName ? "brand" : null,
      name: nameSnippet,
      title: titleSnippet,
      email,
      phone
    },
    excludedEmails,
    excludedNames
  );
}

function extractPrimaryContact(
  aggregate: DealAggregate,
  agencyName: string | null,
  brandName: string | null,
  options?: IntakeNormalizationOptions
): IntakePrimaryContact {
  const excludedEmails = buildExcludedContactEmails(options);
  const excludedNames = buildExcludedContactNames(options);
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.primaryContact;
  if (persisted) {
    const persistedContact = cleanContactCandidate(
      {
        organizationType: persisted.organizationType ?? (agencyName ? "agency" : "brand"),
        name: persisted.name,
        title: persisted.title,
        email: persisted.email,
        phone: persisted.phone
      },
      excludedEmails,
      excludedNames
    );

    if (persistedContact) {
      return persistedContact;
    }

    // Continue into current extraction data so a newly uploaded brief/contract can replace
    // an old empty or creator-profile contact that was previously persisted.
  }

  const structuredContact =
    contactFromBriefData(aggregate, agencyName, brandName, excludedEmails, excludedNames) ??
    contactFromExtractionEvidence(aggregate, agencyName, brandName, excludedEmails, excludedNames);
  if (structuredContact) {
    return structuredContact;
  }

  const documents = [...aggregate.documents].sort(
    (left, right) => lineScore(right.documentKind) - lineScore(left.documentKind)
  );

  for (const document of documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    if (!text) {
      continue;
    }

    const emails = extractEmails(text);
    const phones = extractPhones(text);
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const candidateEmails = emails.filter(
      (email) => !isExcludedContactEmail(email, excludedEmails)
    );
    const excludedEmailIndexes = emails
      .filter((email) => isExcludedContactEmail(email, excludedEmails))
      .map((email) => lines.findIndex((line) => line.includes(email)))
      .filter((index) => index !== -1);
    const candidatePhones = phones.filter((phone) => {
      const phoneIndex = lines.findIndex((line) => line.includes(phone));
      if (phoneIndex === -1) {
        return true;
      }

      return !excludedEmailIndexes.some((emailIndex) => Math.abs(emailIndex - phoneIndex) <= 4);
    });
    const emailIndex = candidateEmails.length
      ? lines.findIndex((line) => line.includes(candidateEmails[0]))
      : -1;
    const phoneIndex = candidatePhones.length
      ? lines.findIndex((line) => line.includes(candidatePhones[0]))
      : -1;
    const anchorIndex = emailIndex !== -1 ? emailIndex : phoneIndex;

    if (
      anchorIndex === -1 &&
      (document.documentKind !== "email_thread" || excludedEmailIndexes.length > 0)
    ) {
      continue;
    }

    const windowStart =
      anchorIndex === -1 ? Math.max(lines.length - 8, 0) : Math.max(0, anchorIndex - 4);
    const windowEnd =
      anchorIndex === -1 ? lines.length : Math.min(lines.length, anchorIndex + 4);
    const windowLines = lines.slice(windowStart, windowEnd);
    const nameLine =
      [...windowLines]
        .sort((left, right) => scoreContactLine(right) - scoreContactLine(left))
        .map((line) => sanitizeContactName(line))
        .find(
          (line): line is string =>
            Boolean(line) && !isExcludedContactName(line, excludedNames)
        ) ?? null;
    const titleLine =
      windowLines
        .map((line) => sanitizeContactTitle(line))
        .find((line): line is string => Boolean(line)) ?? null;

    if (candidateEmails[0] || candidatePhones[0] || nameLine) {
      return {
        organizationType: agencyName ? "agency" : brandName ? "brand" : null,
        name: sanitizeContactName(nameLine),
        title: sanitizeContactTitle(titleLine),
        email: presentText(candidateEmails[0] ?? null),
        phone: presentText(candidatePhones[0] ?? null)
      };
    }
  }

  return emptyPrimaryContact(agencyName, brandName);
}

function extractLikelyBrandFromFileNames(fileNames: string[]) {
  for (const fileName of fileNames) {
    const rawName = presentText(fileName.replace(/\.[a-z0-9]+$/i, ""));
    const rawBriefBrand = sanitizePartyName(
      rawName
        ?.split(/[_:]+/g)[0]
        ?.replace(/[-]+/g, " ")
        .replace(/\b(influencer|campaign|creative|content)\s+brief\b/gi, "")
        .replace(/\bbrief\b/gi, "")
        .trim() ?? null,
      "brand"
    );
    if (rawBriefBrand) {
      return rawBriefBrand;
    }

    const cleaned = cleanFileName(fileName);
    if (!cleaned || isGenericIntakeLabel(cleaned)) {
      continue;
    }

    const briefBrand = sanitizePartyName(
      cleaned
        .split(/\s+[_-]\s+|:\s+/g)[0]
        ?.replace(/\b(influencer|campaign|creative|content)\s+brief\b/gi, "")
        .replace(/\bbrief\b/gi, "")
        .trim() ?? null,
      "brand"
    );
    if (briefBrand) {
      return briefBrand;
    }

    const beforeHandle = cleaned.split(/\s+@\w+/i)[0]?.trim();
    if (beforeHandle) {
      const sanitized = sanitizePartyName(beforeHandle.replace(/\s+x\s*$/i, "").trim(), "brand");
      if (sanitized) {
        return sanitized;
      }
    }

    const fallbackBrand = sanitizePartyName(cleaned, "brand");
    if (fallbackBrand) {
      return fallbackBrand;
    }
  }

  return null;
}

function extractBrandFromText(text: string) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  const briefHeader = sanitizePartyName(
    firstLine
      ?.replace(/\b(influencer|campaign|creative|content)\s+brief\b/gi, "")
      .replace(/\bbrief\b/gi, "")
      .trim() ?? null,
    "brand"
  );
  if (briefHeader) {
    return briefHeader;
  }

  const directPatterns = [
    /on behalf of our client\s+[–-]\s*([A-Z][A-Za-z0-9&+.' -]+)/i,
    /for\s+([A-Z][A-Za-z0-9&+.' -]{2,40})\s+at\s+[A-Z]/i,
    /join\s+([A-Z][A-Za-z0-9&+.' -]{2,40})'?s affiliate program/i,
    /deliverables?:.*featuring\s+([A-Z][A-Za-z0-9&+.' -]+)/i,
    /^([A-Z][A-Za-z0-9&+.' -]{2,60})\n(?:we are looking|deliverables:)/im
  ];

  for (const pattern of directPatterns) {
    const match = text.match(pattern);
    const candidate = sanitizePartyName(match?.[1] ?? null, "brand");
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function inferBrandName(aggregate: DealAggregate) {
  const persisted = sanitizePartyName(
    getPersistedIntakeRecord(aggregate.summaries)?.brandName,
    "brand"
  );
  if (persisted && !isGenericIntakeLabel(persisted)) {
    return persisted;
  }

  const termsBrand = sanitizePartyName(aggregate.terms?.brandName, "brand");
  if (termsBrand && !/^client\b/i.test(termsBrand) && !isGenericIntakeLabel(termsBrand)) {
    return termsBrand;
  }

  for (const document of aggregate.documents.filter(
    (entry) => entry.documentKind === "email_thread"
  )) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const candidate = extractBrandFromText(text);
    if (candidate) {
      return candidate;
    }
  }

  const fileBrand = extractLikelyBrandFromFileNames(
    aggregate.documents
      .filter((document) => document.documentKind !== "email_thread")
      .map((document) => document.fileName)
  );
  if (fileBrand) {
    return fileBrand;
  }

  for (const document of aggregate.documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const candidate = extractBrandFromText(text);
    if (candidate) {
      return candidate;
    }
  }

  const evidenceSnippet = bestEvidenceSnippet(aggregate.extractionEvidence, [
    "brandName",
    "campaignName"
  ]);
  if (evidenceSnippet) {
    const cleaned = sanitizePartyName(evidenceSnippet, "brand");
    if (cleaned && !isGenericIntakeLabel(cleaned)) {
      return cleaned;
    }
  }

  const dealBrand = sanitizePartyName(aggregate.deal.brandName, "brand");
  return dealBrand && !isGenericIntakeLabel(dealBrand) ? dealBrand : null;
}

function inferAgencyName(aggregate: DealAggregate, brandName: string | null) {
  const persisted = sanitizePartyName(
    getPersistedIntakeRecord(aggregate.summaries)?.agencyName,
    "agency"
  );
  if (persisted) {
    return persisted !== brandName ? persisted : null;
  }

  const direct = sanitizePartyName(aggregate.terms?.agencyName, "agency");
  if (direct && direct !== brandName) {
    return direct;
  }

  for (const document of aggregate.documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const signatureMatch =
      lines.find(
        (line) =>
          /technologies|dynamic|intelligence|agency|media by/i.test(line) &&
          !/manager|director|coordinator|partnership|activation/i.test(line)
      ) ??
      lines.find((line) => /technologies|dynamic|intelligence|agency/i.test(line));
    const candidate = sanitizePartyName(signatureMatch, "agency");
    if (candidate && candidate !== brandName) {
      return candidate;
    }
  }

  return null;
}

function parseMoneyValues(text: string) {
  return Array.from(text.matchAll(/\$[\d,]+(?:\.\d{2})?/g), (match) =>
    Number(match[0].replace(/[$,]/g, ""))
  ).filter((value) => Number.isFinite(value));
}

function inferPaymentAmount(aggregate: DealAggregate) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.paymentAmount;
  if (typeof persisted === "number") {
    return persisted;
  }

  const texts = aggregate.documents
    .map((document) => ({
      kind: document.documentKind,
      text: document.normalizedText ?? document.rawText ?? ""
    }))
    .filter((entry) => entry.text.length > 0);

  const scoredMatches: Array<{ score: number; amount: number }> = [];
  for (const entry of texts) {
    const lines = entry.text.split(/\r?\n/);
    for (const line of lines) {
      if (!/\$[\d,]+/.test(line)) {
        continue;
      }

      const amounts = parseMoneyValues(line);
      if (amounts.length === 0) {
        continue;
      }

      let score = lineScore(entry.kind);
      if (/compensation|payment|fee|budget|rate|agreed|paid/i.test(line)) {
        score += 5;
      }
      if (/stipend|commission|discount/i.test(line)) {
        score -= 1;
      }

      for (const amount of amounts) {
        scoredMatches.push({ score, amount });
      }
    }
  }

  const best = scoredMatches.sort((left, right) => {
    if (right.score === left.score) {
      return right.amount - left.amount;
    }
    return right.score - left.score;
  })[0];

  return best?.amount ?? aggregate.terms?.paymentAmount ?? aggregate.paymentRecord?.amount ?? null;
}

function cleanDeliverables(deliverables: DeliverableItem[]) {
  return deliverables
    .map((item, index) => ({
      ...item,
      id: item.id || `deliverable-${index + 1}`,
      title: cleanExtractedLabel(item.title) ?? item.title,
      description: presentText(item.description),
      source: presentText(item.source)
    }))
    .filter((item) => presentText(item.title));
}

function parseDeliverablesFromText(aggregate: DealAggregate) {
  const found: DeliverableItem[] = [];

  for (const document of aggregate.documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(
        /deliverables?:\s*(?:\((\d+)\)\s*)?([A-Za-z0-9&+/' -]{3,120})/i
      );
      if (!match) {
        continue;
      }

      found.push({
        id: `deliverable-${found.length + 1}`,
        title: match[2].trim(),
        dueDate: null,
        channel: /tiktok/i.test(match[2])
          ? "TikTok"
          : /instagram/i.test(match[2])
            ? "Instagram"
            : /youtube/i.test(match[2])
              ? "YouTube"
              : null,
        quantity: match[1] ? Number(match[1]) : 1,
        status: "pending",
        description: null,
        source: line.trim()
      });
    }
  }

  return found;
}

function campaignWindowFromTimelineItems(timelineItems: IntakeTimelineItem[]) {
  const dated = timelineItems
    .map((item) => presentText(item.date))
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(value) ||
          /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
            value
          ) ||
          /^\d{4}-\d{2}-\d{2}/.test(value))
    )
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right));

  if (dated.length === 0) {
    return null;
  }

  const startDate = dated[0] ?? null;
  const endDate = dated[dated.length - 1] ?? null;

  return {
    startDate,
    endDate,
    postingWindow:
      startDate && endDate && startDate !== endDate
        ? `${startDate} to ${endDate}`
        : startDate ?? endDate ?? null
  };
}

function buildTimelineLabel(snippet: string) {
  const lower = snippet.toLowerCase();
  if (lower.includes("outline")) {
    return "Outline due";
  }
  if (lower.includes("draft")) {
    return "Draft due";
  }
  if (lower.includes("final")) {
    return "Final due";
  }
  if (lower.includes("live")) {
    return "Go live";
  }
  if (lower.includes("review")) {
    return "Review due";
  }
  return "Timeline item";
}

function timelineLabelRank(label: string) {
  switch (label) {
    case "Outline due":
      return 0;
    case "Draft due":
      return 1;
    case "Review due":
      return 2;
    case "Final due":
      return 3;
    case "Go live":
      return 4;
    default:
      return 5;
  }
}

function splitTimelineCandidates(line: string) {
  return line
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isTimelineBoilerplate(snippet: string) {
  return /time is of the essence|notify company|sole discretion|publish|distribute|jurisdiction|ftc|comply|adher(?:e|ence)|approve? for publication|content format|services and deliverables|section \d|schedule \d|agreement|notice|company may|content delivered to company/i.test(
    snippet
  );
}

function scoreTimelineSnippet(snippet: string, kind: DocumentKind, hasDate: boolean) {
  let score = lineScore(kind);

  if (hasDate) {
    score += 5;
  }
  if (/timing:|timeline:|live date|go live|drafts? due|outline due|review by|final due|submission due|due by|due on/i.test(snippet)) {
    score += 4;
  }
  if (/approx|no later than|within|after accepting/i.test(snippet)) {
    score += 2;
  }
  if (/services and deliverables|deliver the content to company|publish|distribute|jurisdiction|sole discretion/i.test(snippet)) {
    score -= 6;
  }

  return score;
}

function extractTimelineItems(aggregate: DealAggregate) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.timelineItems;
  if (persisted?.length) {
    return persisted;
  }

  const snippets = new Map<
    string,
    IntakeTimelineItem & { score: number; sourceLength: number }
  >();
  const datePattern =
    /\b(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?|\d+\s*(?:hrs?|hours?|days?)\s+after)\b/i;

  for (const document of aggregate.documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const lines = text.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (!line) {
        continue;
      }
      if (!/(due|draft|final|live|review|outline|submit|submission|timing|timeline)/i.test(line)) {
        continue;
      }

      for (const candidate of splitTimelineCandidates(line)) {
        if (!/(due|draft|final|live|review|outline|submit|submission|timing|timeline)/i.test(candidate)) {
          continue;
        }
        if (isTimelineBoilerplate(candidate)) {
          continue;
        }

        const dateMatch = candidate.match(datePattern);
        const date = presentText(dateMatch?.[0] ?? null);
        if (!date) {
          continue;
        }

        const label = buildTimelineLabel(candidate);
        const key = `${label}:${date.toLowerCase()}`;
        const score = scoreTimelineSnippet(candidate, document.documentKind, true);
        const nextItem: IntakeTimelineItem & { score: number; sourceLength: number } = {
          id: `timeline-${snippets.size + 1}`,
          label,
          date,
          source: candidate,
          status: "scheduled",
          score,
          sourceLength: candidate.length
        };
        const existing = snippets.get(key);

        if (
          !existing ||
          nextItem.score > existing.score ||
          (nextItem.score === existing.score &&
            nextItem.sourceLength < existing.sourceLength)
        ) {
          snippets.set(key, nextItem);
        }
      }
    }
  }

  return Array.from(snippets.values())
    .sort((left, right) => {
      const rankDelta = timelineLabelRank(left.label) - timelineLabelRank(right.label);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      if (right.score === left.score) {
        return left.sourceLength - right.sourceLength;
      }
      return right.score - left.score;
    })
    .slice(0, 6)
    .map(({ score: _score, sourceLength: _sourceLength, ...item }, index) => ({
      ...item,
      id: `timeline-${index + 1}`
    }));
}

function extractAnalytics(aggregate: DealAggregate) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.analytics;
  if (persisted?.highlights?.length) {
    return persisted;
  }

  const highlights: string[] = [];
  const highlightSet = new Set<string>();
  const analyticsDocumentPattern =
    /\b(total viewers|average watch time|watched full video|new followers|traffic sources|top locations|retention rate|performance|performance summary|topline metrics|analyst notes|viewers|impressions|clicks|ctr|conversions|saves|comments)\b/i;
  const analyticsLinePattern =
    /\b(total viewers|average watch time|watched full video|new followers|traffic sources|top locations|retention rate|for you|following|personal profile|female|male|18-24|25-34|35-44|45-54|55\+|impressions|clicks|ctr|conversions|attributed conversions|saves|comments|engagement rate)\b/i;
  const analyticsMetricPattern =
    /(?:\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?s\b|\b\d+(?:\.\d+)?[kKmM]\b|\b\d{1,4}(?:,\d{3})*(?:\.\d+)?\b)/;
  const analyticsBoilerplatePattern =
    /\b(manager\/agency|agreement|term of agreement|usage term|usage platforms|document ref|company|talent manager|services and deliverables)\b/i;
  const analyticsTableLabelPattern =
    /^(impressions|clicks|ctr|saves|comments|attributed conversions|conversions|engagement rate|average watch time|total viewers|new followers|retention rate)$/i;

  function pushHighlight(value: string | null | undefined) {
    const normalized = presentText(value)?.replace(/\s{2,}/g, " ");
    if (!normalized || highlightSet.has(normalized)) {
      return;
    }

    highlightSet.add(normalized);
    highlights.push(normalized);
  }

  for (const document of aggregate.documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    if (!text) {
      continue;
    }

    const fileName = document.fileName.toLowerCase();
    const looksLikeAnalyticsDocument =
      /analytics|insights|performance|viewers|audience|retention|tiktok/i.test(fileName) ||
      Array.from(text.matchAll(new RegExp(analyticsDocumentPattern, "gi"))).length >= 2;

    if (!looksLikeAnalyticsDocument) {
      continue;
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim());

    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index] ?? "";
      if (!trimmed || trimmed.length > 120) {
        continue;
      }
      if (analyticsBoilerplatePattern.test(trimmed)) {
        continue;
      }

      const nextLine = lines
        .slice(index + 1)
        .find((candidate) => candidate.length > 0) ?? null;

      if (
        analyticsTableLabelPattern.test(trimmed) &&
        nextLine &&
        nextLine.length <= 40 &&
        analyticsMetricPattern.test(nextLine)
      ) {
        pushHighlight(`${trimmed}: ${nextLine}`);
        continue;
      }

      if (/^[•*-]\s*/.test(trimmed) || /^(note|insight):/i.test(trimmed)) {
        pushHighlight(trimmed.replace(/^[•*-]\s*/, ""));
        continue;
      }

      if (
        analyticsLinePattern.test(trimmed) &&
        (analyticsMetricPattern.test(trimmed) ||
          /\b(gender|age|traffic sources|top locations|retention rate)\b/i.test(trimmed))
      ) {
        pushHighlight(trimmed);
      }
    }
  }

  return highlights.length > 0 ? { highlights: highlights.slice(0, 6) } : null;
}

function inferContractTitle(
  aggregate: DealAggregate,
  brandName: string | null,
  agencyName: string | null
) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.contractTitle;
  if (persisted && !isGenericIntakeLabel(persisted)) {
    return presentText(persisted);
  }

  const campaign = cleanExtractedLabel(aggregate.terms?.campaignName);
  const campaignSegments = splitLabelSegments(aggregate.terms?.campaignName);
  const normalizedCampaign = sanitizeCampaignName(
    campaignSegments[campaignSegments.length - 1] ?? campaign
  );
  if (normalizedCampaign && !/\bname\b/i.test(aggregate.terms?.campaignName ?? "")) {
    return brandName &&
      !normalizedCampaign.toLowerCase().includes(brandName.toLowerCase())
      ? `${brandName} - ${normalizedCampaign}`
      : normalizedCampaign;
  }

  for (const document of aggregate.documents
    .slice()
    .sort((left, right) => lineScore(right.documentKind) - lineScore(left.documentKind))) {
    if (
      document.documentKind !== "campaign_brief" &&
      document.documentKind !== "deliverables_brief" &&
      document.documentKind !== "pitch_deck"
    ) {
      continue;
    }

    const lines = (document.normalizedText ?? document.rawText ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    for (const line of lines) {
      const candidate = sanitizeCampaignName(line);
      if (!candidate) {
        continue;
      }
      if (brandName && candidate.toLowerCase() === brandName.toLowerCase()) {
        continue;
      }

      return brandName &&
        !candidate.toLowerCase().includes(brandName.toLowerCase())
        ? `${brandName} - ${candidate}`
        : candidate;
    }
  }

  const primaryText = aggregate.documents
    .slice()
    .sort((left, right) => lineScore(right.documentKind) - lineScore(left.documentKind))
    .map((document) => document.normalizedText ?? document.rawText ?? "")
    .find(Boolean);

  if (primaryText) {
    const subject = presentText(
      primaryText
        .match(/^subject:\s*(.+)$/im)?.[1]
        ?.replace(/^(re|fwd?):\s*/gi, "")
        ?.trim() ?? null
    );

    if (subject && !isGenericIntakeLabel(subject)) {
      return brandName && !subject.toLowerCase().includes(brandName.toLowerCase())
        ? `${brandName} - ${subject}`
        : subject;
    }

    const explicitCampaign = sanitizeCampaignName(
      primaryText.match(/^(?:campaign|project)\s*:\s*(.+)$/im)?.[1] ?? null
    );
    if (explicitCampaign) {
      return brandName && !explicitCampaign.toLowerCase().includes(brandName.toLowerCase())
        ? `${brandName} - ${explicitCampaign}`
        : explicitCampaign;
    }
  }

  const derivedFileTitle = deriveWorkspaceTitleFromFileNames(
    aggregate.documents.map((document) => document.fileName)
  );
  if (derivedFileTitle && !isGenericIntakeLabel(derivedFileTitle)) {
    return derivedFileTitle;
  }

  const channels = Array.from(
    new Set(
      (aggregate.terms?.deliverables ?? [])
        .map((item) => `${item.title ?? ""} ${item.channel ?? ""}`)
        .join(" ")
        .match(/\b(TikTok|Instagram|YouTube)\b/gi) ?? []
    )
  )
    .map((entry) =>
      entry.toLowerCase() === "tiktok"
        ? "TikTok"
        : entry.toLowerCase() === "youtube"
          ? "YouTube"
          : "Instagram"
    )
    .slice(0, 2);

  if (brandName && channels.length > 0) {
    return `${brandName} - ${channels.join(" + ")} Partnership`;
  }

  if (brandName && agencyName) {
    return `${brandName} via ${agencyName}`;
  }

  if (brandName) {
    return `${brandName} partnership`;
  }

  return sanitizeCampaignName(aggregate.deal.campaignName);
}

function buildContractSummary(input: {
  brandName: string | null;
  agencyName: string | null;
  contractTitle: string | null;
  paymentAmount: number | null;
  currency: string | null;
  deliverables: DeliverableItem[];
  timelineItems: IntakeTimelineItem[];
}) {
  const parts: string[] = [];

  if (input.contractTitle) {
    parts.push(`This intake is for ${input.contractTitle}.`);
  } else if (input.brandName) {
    parts.push(`This intake is for a ${input.brandName} brand deal.`);
  }

  if (input.agencyName) {
    parts.push(`The partnership appears to be managed through ${input.agencyName}.`);
  }

  if (typeof input.paymentAmount === "number") {
    parts.push(
      `The primary payment extracted so far is ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: input.currency ?? "USD",
        maximumFractionDigits: 2
      }).format(input.paymentAmount)}.`
    );
  }

  if (input.deliverables.length > 0) {
    const titles = input.deliverables
      .slice(0, 2)
      .map((item) => item.title)
      .join(", ");
    parts.push(
      `Current deliverables suggest ${input.deliverables.length} item${input.deliverables.length === 1 ? "" : "s"}${titles ? `, including ${titles}` : ""}.`
    );
  }

  if (input.timelineItems.length > 0) {
    const nextDate = input.timelineItems.find((item) => item.date)?.date;
    if (nextDate) {
      parts.push(`A timeline milestone is already called out for ${nextDate}.`);
    }
  }

  return parts.join(" ").trim() || null;
}

function buildEvidenceGroups(input: {
  aggregate: DealAggregate;
  brandName: string | null;
  agencyName: string | null;
  primaryContact: IntakePrimaryContact;
  contractTitle: string | null;
  timelineItems: IntakeTimelineItem[];
  brandCategory: DealCategory | null;
  disclosureObligations: DisclosureObligation[];
  analytics: IntakeAnalyticsRecord | null;
}) {
  const groups: IntakeEvidenceGroup[] = [];
  const evidence = input.aggregate.extractionEvidence;

  const partnershipSnippets = [
    bestEvidenceSnippet(evidence, ["brandName"]),
    bestEvidenceSnippet(evidence, ["agencyName"]),
    ...input.aggregate.documents.slice(0, 2).map((document) => cleanFileName(document.fileName))
  ].filter((entry): entry is string => Boolean(presentText(entry)));

  groups.push({
    id: "partnership",
    title: "Partnership",
    snippets: Array.from(new Set(partnershipSnippets)).slice(0, 4)
  });

  const contactSnippets = [
    input.primaryContact.name,
    input.primaryContact.title,
    input.primaryContact.email,
    input.primaryContact.phone
  ].filter((entry): entry is string => Boolean(presentText(entry)));

  if (contactSnippets.length > 0) {
    groups.push({
      id: "primary-contact",
      title: "Primary contact",
      snippets: contactSnippets
    });
  }

  const snapshotSnippets = [
    input.contractTitle,
    bestEvidenceSnippet(evidence, ["campaignName"]),
    bestEvidenceSnippet(evidence, ["paymentAmount"])
  ].filter((entry): entry is string => Boolean(presentText(entry)));

  groups.push({
    id: "contract-snapshot",
    title: "Contract snapshot",
    snippets: Array.from(new Set(snapshotSnippets)).slice(0, 4)
  });

  const intelligenceSnippets = [
    input.brandCategory ? input.brandCategory.replace(/_/g, " ") : null,
    ...input.disclosureObligations.map((entry) => entry.title)
  ].filter((entry): entry is string => Boolean(presentText(entry)));

  if (intelligenceSnippets.length > 0) {
    groups.push({
      id: "rights-and-disclosure",
      title: "Rights and disclosure",
      snippets: Array.from(new Set(intelligenceSnippets)).slice(0, 6)
    });
  }

  if (input.timelineItems.length > 0) {
    groups.push({
      id: "timeline",
      title: "Deliverables and timeline",
      snippets: input.timelineItems
        .map((item) => item.source)
        .filter((entry): entry is string => Boolean(presentText(entry)))
        .slice(0, 6)
    });
  }

  if ((input.analytics?.highlights?.length ?? 0) > 0) {
    groups.push({
      id: "analytics",
      title: "Audience and analytics",
      snippets: (input.analytics?.highlights ?? []).slice(0, 6)
    });
  }

  return groups.filter((group) => group.snippets.length > 0);
}

export function buildNormalizedIntakeRecord(
  aggregate: DealAggregate | null,
  options?: IntakeNormalizationOptions
): NormalizedIntakeRecord | null {
  if (!aggregate) {
    return null;
  }

  const persisted = getPersistedIntakeRecord(aggregate.summaries);
  const brandName = inferBrandName(aggregate);
  const agencyName = inferAgencyName(aggregate, brandName);
  const primaryContact = extractPrimaryContact(aggregate, agencyName, brandName, options);
  const contractTitle = inferContractTitle(aggregate, brandName, agencyName);
  const paymentAmount = inferPaymentAmount(aggregate);
  const persistedDeliverables = Array.isArray(persisted?.deliverables)
    ? persisted.deliverables
    : [];
  const aggregateDeliverables = Array.isArray(aggregate.terms?.deliverables)
    ? aggregate.terms.deliverables
    : [];
  const deliverables = cleanDeliverables(
    persistedDeliverables.length > 0
      ? persistedDeliverables
      : aggregateDeliverables.length > 0
        ? aggregateDeliverables
        : parseDeliverablesFromText(aggregate)
  );
  const timelineItems =
    Array.isArray(persisted?.timelineItems) && persisted.timelineItems.length > 0
      ? persisted.timelineItems
      : extractTimelineItems(aggregate);
  const analytics =
    Array.isArray(persisted?.analytics?.highlights) && persisted.analytics.highlights.length > 0
      ? persisted.analytics
      : extractAnalytics(aggregate);
  const brandCategory = persisted?.brandCategory ?? aggregate.terms?.brandCategory ?? null;
  const competitorCategories =
    Array.isArray(persisted?.competitorCategories) && persisted.competitorCategories.length > 0
      ? persisted.competitorCategories
      : aggregate.terms?.competitorCategories ?? [];
  const restrictedCategories =
    Array.isArray(persisted?.restrictedCategories) && persisted.restrictedCategories.length > 0
      ? persisted.restrictedCategories
      : aggregate.terms?.restrictedCategories ?? [];
  const campaignDateWindow =
    persisted?.campaignDateWindow ??
    aggregate.terms?.campaignDateWindow ??
    campaignWindowFromTimelineItems(timelineItems);
  const disclosureObligations =
    Array.isArray(persisted?.disclosureObligations) && persisted.disclosureObligations.length > 0
      ? persisted.disclosureObligations
      : aggregate.terms?.disclosureObligations ?? [];
  const contractSummary =
    toPlainDealSummary(persisted?.contractSummary) ??
    buildContractSummary({
      brandName,
      agencyName,
      contractTitle,
      paymentAmount,
      currency: aggregate.terms?.currency ?? aggregate.paymentRecord?.currency ?? "USD",
      deliverables,
      timelineItems
    }) ??
    toPlainDealSummary(aggregate.currentSummary?.body);

  const notes = presentText(persisted?.notes) ?? presentText(aggregate.terms?.notes);
  const evidenceGroups = buildEvidenceGroups({
    aggregate,
    brandName,
    agencyName,
    primaryContact,
    contractTitle,
    timelineItems,
    brandCategory,
    disclosureObligations,
    analytics
  });

  return {
    brandName,
    agencyName,
    primaryContact,
    contractTitle,
    contractSummary,
    paymentAmount,
    currency: aggregate.terms?.currency ?? aggregate.paymentRecord?.currency ?? "USD",
    deliverableCount:
      deliverables.reduce((count, item) => count + (item.quantity ?? 1), 0) ||
      deliverables.length,
    deliverables,
    timelineItems,
    brandCategory,
    competitorCategories,
    restrictedCategories,
    campaignDateWindow,
    disclosureObligations,
    analytics,
    notes,
    evidenceGroups
  };
}

export function createPersistedIntakeRecord(
  normalized: Pick<
    NormalizedIntakeRecord,
    | "brandName"
    | "agencyName"
    | "primaryContact"
    | "contractTitle"
    | "contractSummary"
    | "paymentAmount"
    | "currency"
    | "deliverables"
    | "timelineItems"
    | "brandCategory"
    | "competitorCategories"
    | "restrictedCategories"
    | "campaignDateWindow"
    | "disclosureObligations"
    | "analytics"
    | "notes"
  >
) {
  return {
    body: JSON.stringify(normalized),
    version: INTAKE_NORMALIZED_VERSION
  };
}
