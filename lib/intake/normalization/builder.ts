/**
 * This file turns extracted intake data into the normalized record the UI can edit and confirm.
 * It is where evidence gets cleaned up and merged into one consistent intake shape.
 */
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
  SummaryRecord,
} from "@/lib/types";
import { CATEGORY_KEYWORDS, normalizeDealCategory } from "@/lib/conflict-categories";
import { stripInlineMarkdown, toPlainDealSummary } from "@/lib/deal-summary";
import { sanitizeCampaignName, sanitizePartyName } from "@/lib/party-labels";
import { sanitizePlainTextInput } from "@/lib/utils";
import {
  cleanWorkspaceFileName,
  deriveWorkspaceTitleFromFileNames,
  isGenericWorkspaceLabel,
} from "@/lib/workspace-labels";
import { formatDeliverableTitle } from "./deliverable-formatter";

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

function sanitizeDisplayText(value: string | null | undefined) {
  const cleaned = sanitizePlainTextInput(value);
  return presentText(cleaned);
}

function sanitizeDisplayList(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => sanitizeDisplayText(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function cleanCampaignDateWindow(value: CampaignDateWindow | null | undefined) {
  if (!value) {
    return null;
  }

  const startDate = sanitizeDisplayText(value.startDate);
  const endDate = sanitizeDisplayText(value.endDate);
  const postingWindow = sanitizeDisplayText(value.postingWindow);

  if (!startDate && !endDate && !postingWindow) {
    return null;
  }

  return {
    startDate,
    endDate,
    postingWindow,
  };
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

// fallow-ignore-next-line complexity
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

const TITLE_CONNECTOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "with",
  "x",
]);

const GENERIC_TITLE_ROLE_TOKENS = new Set([
  "agreement",
  "brand",
  "campaign",
  "collab",
  "collaboration",
  "content",
  "contract",
  "creator",
  "deal",
  "influencer",
  "partnership",
  "talent",
  "ugc",
]);

function humanizeTitleCandidate(value: string | null | undefined) {
  const normalized = presentText(stripInlineMarkdown(value ?? ""))
    ?.replace(/[_|]+/g, " ")
    ?.replace(/\s{2,}/g, " ")
    ?.trim();
  if (!normalized) {
    return null;
  }

  const looksFlatCase =
    normalized === normalized.toLowerCase() || normalized === normalized.toUpperCase();
  if (!looksFlatCase) {
    return normalized;
  }

  return normalized
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (!/[a-z]/.test(word)) {
        return word;
      }

      if (index > 0 && TITLE_CONNECTOR_WORDS.has(word)) {
        return word;
      }

      return `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`;
    })
    .join(" ");
}

function humanizeBrandLabel(value: string | null | undefined) {
  const normalized = presentText(value);
  if (!normalized) {
    return null;
  }

  return humanizeTitleCandidate(normalized);
}

function stripTrailingRoleWords(value: string | null | undefined) {
  const normalized = presentText(value);
  if (!normalized) {
    return null;
  }

  const stripped = normalized
    .replace(/\b(creator|influencer|talent|ugc|email|thread|message|msg)\b\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return presentText(stripped);
}

function normalizedTitleTokens(value: string | null | undefined) {
  return (
    presentText(value)
      ?.toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  ).filter(Boolean);
}

function isWeakRoleBasedTitle(
  value: string | null | undefined,
  brandName: string | null,
  agencyName: string | null
) {
  const tokens = normalizedTitleTokens(value);
  if (tokens.length === 0) {
    return true;
  }

  const hasGenericRoleToken = tokens.some((token) => GENERIC_TITLE_ROLE_TOKENS.has(token));
  if (!hasGenericRoleToken) {
    return false;
  }

  const ignoredTokens = new Set([
    ...normalizedTitleTokens(brandName),
    ...normalizedTitleTokens(agencyName),
    ...Array.from(GENERIC_TITLE_ROLE_TOKENS),
  ]);

  const specificTokens = tokens.filter((token) => !ignoredTokens.has(token));
  return specificTokens.length === 0;
}

function combineBrandAndTitle(
  brandName: string | null,
  candidate: string | null,
  agencyName: string | null
) {
  const normalized = humanizeTitleCandidate(stripTrailingRoleWords(candidate));
  if (
    !normalized ||
    isGenericIntakeLabel(normalized) ||
    isWeakRoleBasedTitle(normalized, brandName, agencyName)
  ) {
    return null;
  }

  return brandName && !normalized.toLowerCase().includes(brandName.toLowerCase())
    ? `${brandName} - ${normalized}`
    : normalized;
}

function buildReadableDeliverableTitle(brandName: string | null, deliverables: DeliverableItem[]) {
  if (!brandName || deliverables.length === 0) {
    return null;
  }

  const labels: string[] = [];
  const seen = new Set<string>();

  for (const item of deliverables) {
    const title = humanizeTitleCandidate(item.title);
    const channel = humanizeTitleCandidate(item.channel);
    const preferredLabel =
      title && !isGenericIntakeLabel(title)
        ? title
        : channel && !isGenericIntakeLabel(channel)
          ? channel
          : null;

    if (!preferredLabel) {
      continue;
    }

    const normalizedLabel = preferredLabel.toLowerCase();
    if (seen.has(normalizedLabel)) {
      continue;
    }

    seen.add(normalizedLabel);
    labels.push(preferredLabel);

    if (labels.length === 2) {
      break;
    }
  }

  if (labels.length === 0) {
    return null;
  }

  return `${brandName} ${labels.join(" + ")} Partnership`;
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

function getPersistedIntakeRecord(summaries: SummaryRecord[]): PersistedIntakeRecord | null {
  return parsePersistedIntakeRecord(
    summaries.find((entry) => entry.version === INTAKE_NORMALIZED_VERSION) ?? null
  );
}

function bestEvidenceSnippet(entries: ExtractionEvidenceRecord[], fieldPaths: string[]) {
  return (
    entries.find((entry) => fieldPaths.includes(entry.fieldPath) && presentText(entry.snippet))
      ?.snippet ?? null
  );
}

function extractEmails(text: string) {
  return Array.from(
    new Set(
      Array.from(text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi), (match) =>
        match[0].trim()
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
        text.matchAll(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g),
        (match) => match[0].trim()
      )
    )
  );
}

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "icloud.com",
  "me.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "aol.com",
]);

const CREATOR_CONTACT_CONTEXT_PATTERN =
  /\b(creator|talent|influencer|pay creator|creator address|creator phone|creator email)\b/i;
const PAYMENT_CONTACT_CONTEXT_PATTERN =
  /\b(payment|invoice|billing|remit|wire|ach|w-9|tax|accounts payable)\b/i;
const EXTERNAL_CONTACT_SIGNAL_PATTERN =
  /\b(brand|agency|management|partnerships?|campaign|marketing|media|approval|approvals|questions|contact|manager|director|coordinator|executive|team)\b/i;
const CATEGORY_INLINE_PATTERN = /\b(?:brand\s+category|industry|vertical|sector)\b[:\s-]+(.+)$/i;
const CATEGORY_LABEL_PATTERN = /^(?:brand\s+category|industry|vertical|sector)$/i;
const CATEGORY_CONTEXT_EXCLUSION_PATTERN =
  /\b(competitor|restricted|restriction|exclusiv(?:e|ity)|conflict|blackout|prohibited|avoid)\b/i;
const CATEGORY_FOCUS_LABEL_PATTERN =
  /^(?:project|campaign|brand(?:\s+name)?|client|product|collection|line)$/i;
const CATEGORY_FOCUS_LINE_PATTERN =
  /\b(?:project|campaign|brand(?:\s+name)?|client|product|collection|line|deliverables?|featuring)\b/i;

function buildExcludedContactEmails(options: IntakeNormalizationOptions | undefined) {
  return new Set(
    (options?.excludedPrimaryContactEmails ?? [])
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => Boolean(email))
  );
}

function buildExcludedContactDomains(options: IntakeNormalizationOptions | undefined) {
  return new Set(
    (options?.excludedPrimaryContactEmails ?? [])
      .map((email) => normalizeEmail(email)?.split("@")[1] ?? null)
      .filter(
        (domain): domain is string =>
          typeof domain === "string" && !PUBLIC_EMAIL_DOMAINS.has(domain)
      )
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
  if (
    /manager|director|partnership|campaign|media|marketing|talent|agent|coordinator/.test(lower)
  ) {
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
    /\b(manager|director|lead|specialist|executive|strategist|partnerships?|campaign|marketing|media|talent|agent|coordinator|producer|contact|email|phone|agency|brand|team|technologies|technology|company|studios|network|llc|inc|ltd)\b/.test(
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

function emptyPrimaryContact(
  agencyName: string | null,
  brandName: string | null
): IntakePrimaryContact {
  return {
    organizationType: agencyName ? "agency" : brandName ? "brand" : null,
    name: null,
    title: null,
    email: null,
    phone: null,
  };
}

function cleanContactCandidate(
  contact: IntakePrimaryContact,
  excludedEmails: Set<string>,
  excludedNames: Set<string>,
  excludedDomains: Set<string>
) {
  const normalizedEmail = normalizeEmail(contact.email);
  const emailDomain = normalizedEmail?.split("@")[1] ?? null;
  if (
    isExcludedContactEmail(contact.email, excludedEmails) ||
    isExcludedContactName(contact.name, excludedNames)
  ) {
    return null;
  }
  if (emailDomain && excludedDomains.has(emailDomain)) {
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
    phone,
  } satisfies IntakePrimaryContact;
}

function normalizeOrganizationToken(value: string | null | undefined) {
  const normalized = presentText(value);
  if (!normalized) {
    return null;
  }

  return normalized.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function organizationContextTokens(value: string | null | undefined) {
  const normalized = presentText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        ![
          "agency",
          "company",
          "management",
          "group",
          "llc",
          "inc",
          "ltd",
          "co",
          "corp",
        ].includes(token)
    );
}

function windowMentionsOrganization(windowText: string, organizationName: string | null | undefined) {
  const tokens = organizationContextTokens(organizationName);
  if (tokens.length === 0) {
    return false;
  }

  const lowerWindowText = windowText.toLowerCase();
  return tokens.every((token) => lowerWindowText.includes(token));
}

function inferOrganizationTypeFromSignals(input: {
  email: string | null;
  agencyName: string | null;
  brandName: string | null;
  windowLines: string[];
}) {
  const windowText = input.windowLines.join("\n").toLowerCase();
  const normalizedWindowText = normalizeOrganizationToken(windowText);
  const emailDomainRoot =
    normalizeEmail(input.email)
      ?.split("@")[1]
      ?.split(".")[0]
      ?.replace(/[^a-z0-9]/g, "") ?? null;
  const normalizedAgency = normalizeOrganizationToken(input.agencyName);
  const normalizedBrand = normalizeOrganizationToken(input.brandName);

  if (
    (normalizedAgency && normalizedWindowText?.includes(normalizedAgency)) ||
    windowMentionsOrganization(windowText, input.agencyName)
  ) {
    return "agency" as const;
  }
  if (
    (normalizedBrand && normalizedWindowText?.includes(normalizedBrand)) ||
    windowMentionsOrganization(windowText, input.brandName)
  ) {
    return "brand" as const;
  }
  if (emailDomainRoot && normalizedAgency && emailDomainRoot.includes(normalizedAgency)) {
    return "agency" as const;
  }
  if (emailDomainRoot && normalizedBrand && emailDomainRoot.includes(normalizedBrand)) {
    return "brand" as const;
  }
  if (/\b(agency|management|talent management)\b/.test(windowText)) {
    return "agency" as const;
  }
  if (/\b(brand|client)\b/.test(windowText)) {
    return "brand" as const;
  }

  return input.agencyName ? "agency" : input.brandName ? "brand" : null;
}

function isRejectedExternalContactWindow(lines: string[]) {
  const text = lines.join("\n");
  if (CREATOR_CONTACT_CONTEXT_PATTERN.test(text)) {
    return true;
  }

  return PAYMENT_CONTACT_CONTEXT_PATTERN.test(text) && !EXTERNAL_CONTACT_SIGNAL_PATTERN.test(text);
}

function nearestPhoneFromWindow(lines: string[], emailIndex: number) {
  let best: { phone: string; distance: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (CREATOR_CONTACT_CONTEXT_PATTERN.test(line) || PAYMENT_CONTACT_CONTEXT_PATTERN.test(line)) {
      continue;
    }

    const phone = extractPhones(line)[0] ?? null;
    if (!phone) {
      continue;
    }

    const distance = Math.abs(index - emailIndex);
    if (distance > 2) {
      continue;
    }

    if (!best || distance < best.distance) {
      best = { phone, distance };
    }
  }

  return best?.phone ?? null;
}

// fallow-ignore-next-line complexity
function buildPrimaryContactFromDocumentText(input: {
  aggregate: DealAggregate;
  agencyName: string | null;
  brandName: string | null;
  excludedEmails: Set<string>;
  excludedNames: Set<string>;
  excludedDomains: Set<string>;
}) {
  const documents = [...input.aggregate.documents].sort(
    (left, right) => lineScore(right.documentKind) - lineScore(left.documentKind)
  );

  type ContactCandidate = IntakePrimaryContact & { score: number };
  const candidates: ContactCandidate[] = [];

  for (const document of documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    if (!text) {
      continue;
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const emails = extractEmails(text).filter(
      (email) =>
        !isExcludedContactEmail(email, input.excludedEmails) &&
        !input.excludedDomains.has(normalizeEmail(email)?.split("@")[1] ?? "")
    );

    for (const email of emails) {
      const emailIndex = lines.findIndex((line) => line.includes(email));
      if (emailIndex === -1) {
        continue;
      }

      const windowStart = Math.max(0, emailIndex - 3);
      const windowEnd = Math.min(lines.length, emailIndex + 4);
      const windowLines = lines.slice(windowStart, windowEnd);
      if (isRejectedExternalContactWindow(windowLines)) {
        continue;
      }

      const localEmailIndex = emailIndex - windowStart;
      const candidateName =
        [...windowLines]
          .slice(0, localEmailIndex + 1)
          .reverse()
          .map((line) => sanitizeContactName(line))
          .find(
            (line): line is string =>
              Boolean(line) && !isExcludedContactName(line, input.excludedNames)
          ) ?? null;
      const candidateTitle =
        windowLines
          .map((line) => sanitizeContactTitle(line))
          .find((line): line is string => Boolean(line)) ?? null;
      const organizationType = inferOrganizationTypeFromSignals({
        email,
        agencyName: input.agencyName,
        brandName: input.brandName,
        windowLines,
      });
      const candidate = cleanContactCandidate(
        {
          organizationType,
          name: candidateName,
          title: candidateTitle,
          email,
          phone: nearestPhoneFromWindow(windowLines, localEmailIndex),
        },
        input.excludedEmails,
        input.excludedNames,
        input.excludedDomains
      );

      if (!candidate) {
        continue;
      }

      const score =
        (candidate.email ? 4 : 0) +
        (candidate.name ? 3 : 0) +
        (candidate.title ? 2 : 0) +
        (candidate.phone ? 1 : 0) +
        (candidate.organizationType ? 2 : 0);
      candidates.push({
        ...candidate,
        score,
      });
    }
  }

  return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
}

// fallow-ignore-next-line complexity
function contactFromBriefData(
  aggregate: DealAggregate,
  agencyName: string | null,
  brandName: string | null,
  excludedEmails: Set<string>,
  excludedNames: Set<string>,
  excludedDomains: Set<string>
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
      phone: briefData.agencyContactPhone ?? null,
    },
    excludedEmails,
    excludedNames,
    excludedDomains
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
      phone: briefData.brandContactPhone ?? null,
    },
    excludedEmails,
    excludedNames,
    excludedDomains
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
      phone: linkPhone,
    },
    excludedEmails,
    excludedNames,
    excludedDomains
  );
}

// fallow-ignore-next-line complexity
function contactFromExtractionEvidence(
  aggregate: DealAggregate,
  agencyName: string | null,
  brandName: string | null,
  excludedEmails: Set<string>,
  excludedNames: Set<string>,
  excludedDomains: Set<string>
) {
  const candidates = new Map<string, IntakePrimaryContact & { score: number }>();

  for (const entry of aggregate.extractionEvidence) {
    let organizationType: IntakePrimaryContact["organizationType"] = null;
    let field: "name" | "title" | "email" | "phone" | null = null;

    if (entry.fieldPath.startsWith("briefData.agencyContact")) {
      organizationType = "agency";
    } else if (entry.fieldPath.startsWith("briefData.brandContact")) {
      organizationType = "brand";
    }

    if (entry.fieldPath.endsWith("Name")) field = "name";
    if (entry.fieldPath.endsWith("Title")) field = "title";
    if (entry.fieldPath.endsWith("Email")) field = "email";
    if (entry.fieldPath.endsWith("Phone")) field = "phone";

    if (!organizationType || !field) {
      continue;
    }

    const key = `${organizationType}:${entry.sectionId ?? entry.fieldPath}`;
    const current = candidates.get(key) ?? {
      organizationType,
      name: null,
      title: null,
      email: null,
      phone: null,
      score: 0,
    };
    const nextValue =
      field === "email"
        ? (extractEmails(entry.snippet)[0] ?? presentText(entry.snippet))
        : field === "phone"
          ? (extractPhones(entry.snippet)[0] ?? presentText(entry.snippet))
          : presentText(entry.snippet);

    candidates.set(key, {
      ...current,
      [field]: nextValue,
      score: current.score + 1,
    });
  }

  const bestCandidate = [...candidates.values()]
    .map((candidate) =>
      cleanContactCandidate(candidate, excludedEmails, excludedNames, excludedDomains)
        ? {
            ...candidate,
            score:
              candidate.score +
              (candidate.email ? 4 : 0) +
              (candidate.name ? 3 : 0) +
              (candidate.title ? 2 : 0) +
              (candidate.phone ? 1 : 0),
          }
        : null
    )
    .filter(
      (candidate): candidate is IntakePrimaryContact & { score: number } => candidate !== null
    )
    .sort((left, right) => right.score - left.score)[0];

  if (!bestCandidate) {
    return null;
  }

  return cleanContactCandidate(
    {
      organizationType: bestCandidate.organizationType,
      name: bestCandidate.name,
      title: bestCandidate.title,
      email: bestCandidate.email,
      phone: bestCandidate.phone,
    },
    excludedEmails,
    excludedNames,
    excludedDomains
  );
}

function extractPrimaryContact(
  aggregate: DealAggregate,
  agencyName: string | null,
  brandName: string | null,
  options?: IntakeNormalizationOptions
): IntakePrimaryContact {
  const excludedEmails = buildExcludedContactEmails(options);
  const excludedDomains = buildExcludedContactDomains(options);
  const excludedNames = buildExcludedContactNames(options);
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.primaryContact;
  if (persisted) {
    const persistedContact = cleanContactCandidate(
      {
        organizationType: persisted.organizationType ?? (agencyName ? "agency" : "brand"),
        name: persisted.name,
        title: persisted.title,
        email: persisted.email,
        phone: persisted.phone,
      },
      excludedEmails,
      excludedNames,
      excludedDomains
    );

    if (persistedContact) {
      return persistedContact;
    }

    // Continue into current extraction data so a newly uploaded brief/contract can replace
    // an old empty or creator-profile contact that was previously persisted.
  }

  const structuredContact =
    contactFromBriefData(
      aggregate,
      agencyName,
      brandName,
      excludedEmails,
      excludedNames,
      excludedDomains
    ) ??
    contactFromExtractionEvidence(
      aggregate,
      agencyName,
      brandName,
      excludedEmails,
      excludedNames,
      excludedDomains
    );
  if (structuredContact) {
    return structuredContact;
  }

  const documentContact = buildPrimaryContactFromDocumentText({
    aggregate,
    agencyName,
    brandName,
    excludedEmails,
    excludedNames,
    excludedDomains,
  });
  if (documentContact) {
    return documentContact;
  }

  return emptyPrimaryContact(agencyName, brandName);
}

// fallow-ignore-next-line complexity
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
    /^([A-Z][A-Za-z0-9&+.' -]{2,60})\n(?:we are looking|deliverables:)/im,
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

// fallow-ignore-next-line complexity
function inferBrandName(aggregate: DealAggregate) {
  const persisted = sanitizePartyName(
    getPersistedIntakeRecord(aggregate.summaries)?.brandName,
    "brand"
  );
  if (persisted && !isGenericIntakeLabel(persisted)) {
    return humanizeBrandLabel(persisted);
  }

  const termsBrand = sanitizePartyName(aggregate.terms?.brandName, "brand");
  if (termsBrand && !/^client\b/i.test(termsBrand) && !isGenericIntakeLabel(termsBrand)) {
    return humanizeBrandLabel(termsBrand);
  }

  for (const document of aggregate.documents.filter(
    (entry) => entry.documentKind === "email_thread"
  )) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const candidate = extractBrandFromText(text);
    if (candidate) {
      return humanizeBrandLabel(candidate);
    }
  }

  const fileBrand = extractLikelyBrandFromFileNames(
    aggregate.documents
      .filter((document) => document.documentKind !== "email_thread")
      .map((document) => document.fileName)
  );
  if (fileBrand) {
    return humanizeBrandLabel(fileBrand);
  }

  for (const document of aggregate.documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const candidate = extractBrandFromText(text);
    if (candidate) {
      return humanizeBrandLabel(candidate);
    }
  }

  const evidenceSnippet = bestEvidenceSnippet(aggregate.extractionEvidence, [
    "brandName",
    "campaignName",
  ]);
  if (evidenceSnippet) {
    const cleaned = sanitizePartyName(evidenceSnippet, "brand");
    if (cleaned && !isGenericIntakeLabel(cleaned)) {
      return humanizeBrandLabel(cleaned);
    }
  }

  const dealBrand = sanitizePartyName(aggregate.deal.brandName, "brand");
  return dealBrand && !isGenericIntakeLabel(dealBrand) ? humanizeBrandLabel(dealBrand) : null;
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

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const inlineOwnerMatch = line.match(
        /\b(?:owner|agency|management company|represented by|managed by)\b[:\s-]+(.+)$/i
      );
      const inlineCandidate = sanitizePartyName(inlineOwnerMatch?.[1] ?? null, "agency");
      if (inlineCandidate && inlineCandidate !== brandName) {
        return inlineCandidate;
      }

      if (/^(?:owner|agency|management company|represented by|managed by)$/i.test(line)) {
        const pairedCandidate = sanitizePartyName(lines[index + 1] ?? null, "agency");
        if (pairedCandidate && pairedCandidate !== brandName) {
          return pairedCandidate;
        }
      }
    }

    const signatureMatch =
      lines.find(
        (line) =>
          /technologies|dynamic|intelligence|agency|media by/i.test(line) &&
          !/manager|director|coordinator|partnership|activation/i.test(line)
      ) ?? lines.find((line) => /technologies|dynamic|intelligence|agency/i.test(line));
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textContainsCategoryKeyword(text: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedKeyword.includes(" ") || /[^a-z0-9\s]/i.test(normalizedKeyword)) {
    return text.includes(normalizedKeyword);
  }

  const pattern = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, "i");
  return pattern.test(text);
}

function scoreBrandCategoryText(text: string, category: DealCategory) {
  const lower = text.toLowerCase();
  return CATEGORY_KEYWORDS[category].reduce((score, keyword) => {
    if (textContainsCategoryKeyword(lower, keyword)) {
      return score + Math.max(1, keyword.split(/[\s-]+/).filter(Boolean).length);
    }

    return score;
  }, 0);
}

function inferBrandCategoryFromDocuments(aggregate: DealAggregate) {
  const evidenceCategory = normalizeDealCategory(
    bestEvidenceSnippet(aggregate.extractionEvidence, ["brandCategory"])
  );
  if (evidenceCategory) {
    return evidenceCategory;
  }

  const candidateTexts: string[] = [];

  for (const document of aggregate.documents) {
    const lines = (document.normalizedText ?? document.rawText ?? "")
      .split(/\r?\n/)
      .map((line) => presentText(line))
      .filter((line): line is string => Boolean(line));

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";

      const inlineMatch = line.match(CATEGORY_INLINE_PATTERN);
      if (
        inlineMatch &&
        !CATEGORY_CONTEXT_EXCLUSION_PATTERN.test(line) &&
        !CATEGORY_CONTEXT_EXCLUSION_PATTERN.test(inlineMatch[1] ?? "")
      ) {
        const explicitCategory = normalizeDealCategory(inlineMatch[1]);
        if (explicitCategory) {
          return explicitCategory;
        }
      }

      if (CATEGORY_LABEL_PATTERN.test(line)) {
        const pairedValue = lines[index + 1] ?? null;
        if (!pairedValue || CATEGORY_CONTEXT_EXCLUSION_PATTERN.test(pairedValue)) {
          continue;
        }

        const explicitCategory = normalizeDealCategory(pairedValue);
        if (explicitCategory) {
          return explicitCategory;
        }
      }

      if (CATEGORY_CONTEXT_EXCLUSION_PATTERN.test(line)) {
        continue;
      }

      if (index < 14 || CATEGORY_FOCUS_LINE_PATTERN.test(line)) {
        candidateTexts.push(line);
      }

      if (CATEGORY_FOCUS_LABEL_PATTERN.test(line)) {
        const pairedValue = lines[index + 1] ?? null;
        if (pairedValue && !CATEGORY_CONTEXT_EXCLUSION_PATTERN.test(pairedValue)) {
          candidateTexts.push(pairedValue);
        }
      }
    }

    candidateTexts.push(cleanFileName(document.fileName));
  }

  const combinedText = sanitizeDisplayList([
    aggregate.deal.brandName,
    aggregate.deal.campaignName,
    aggregate.terms?.brandName,
    aggregate.terms?.campaignName,
    ...candidateTexts,
  ]).join("\n");

  if (!combinedText) {
    return null;
  }

  let bestCategory: DealCategory | null = null;
  let bestScore = 0;

  for (const category of Object.keys(CATEGORY_KEYWORDS) as DealCategory[]) {
    if (category === "other") {
      continue;
    }

    const score = scoreBrandCategoryText(combinedText, category);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestScore >= 2 ? bestCategory : null;
}

// fallow-ignore-next-line complexity
function inferPaymentAmount(aggregate: DealAggregate) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.paymentAmount;
  if (typeof persisted === "number") {
    return persisted;
  }

  const texts = aggregate.documents
    .map((document) => ({
      kind: document.documentKind,
      text: document.normalizedText ?? document.rawText ?? "",
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
      title:
        sanitizeDisplayText(
          formatDeliverableTitle(cleanExtractedLabel(item.title) ?? item.title, item.source) ??
            cleanExtractedLabel(item.title) ??
            item.title
        ) ?? item.title,
      description: sanitizeDisplayText(item.description),
      source: sanitizeDisplayText(item.source),
    }))
    .filter((item) => presentText(item.title));
}

function cleanTimelineItems(items: IntakeTimelineItem[]) {
  return items
    .map((item, index) => {
      const label = sanitizeDisplayText(item.label);
      if (!label) {
        return null;
      }

      return {
        ...item,
        id: item.id || `timeline-${index + 1}`,
        label,
        date: sanitizeDisplayText(item.date),
        source: sanitizeDisplayText(item.source),
      };
    })
    .filter((item): item is IntakeTimelineItem => Boolean(item));
}

function cleanDisclosureObligations(items: DisclosureObligation[]) {
  return items
    .map((item, index) => {
      const title = sanitizeDisplayText(item.title);
      const detail = sanitizeDisplayText(item.detail);
      if (!title || !detail) {
        return null;
      }

      return {
        ...item,
        id: item.id || `disclosure-${index + 1}`,
        title,
        detail,
        source: sanitizeDisplayText(item.source),
      };
    })
    .filter((item): item is DisclosureObligation => Boolean(item));
}

function cleanAnalytics(analytics: IntakeAnalyticsRecord | null | undefined) {
  if (!analytics) {
    return null;
  }

  const highlights = sanitizeDisplayList(analytics.highlights ?? []).slice(0, 6);
  return highlights.length > 0 ? { highlights } : null;
}

// fallow-ignore-next-line complexity
function parseDeliverablesFromText(aggregate: DealAggregate) {
  const found: DeliverableItem[] = [];

  for (const document of aggregate.documents) {
    const text = document.normalizedText ?? document.rawText ?? "";
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(/deliverables?:\s*(?:\((\d+)\)\s*)?([A-Za-z0-9&+/' -]{3,120})/i);
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
        source: line.trim(),
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
        : (startDate ?? endDate ?? null),
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
  if (
    /timing:|timeline:|live date|go live|drafts? due|outline due|review by|final due|submission due|due by|due on/i.test(
      snippet
    )
  ) {
    score += 4;
  }
  if (/approx|no later than|within|after accepting/i.test(snippet)) {
    score += 2;
  }
  if (
    /services and deliverables|deliver the content to company|publish|distribute|jurisdiction|sole discretion/i.test(
      snippet
    )
  ) {
    score -= 6;
  }

  return score;
}

// fallow-ignore-next-line complexity
function extractTimelineItems(aggregate: DealAggregate) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.timelineItems;
  if (persisted?.length) {
    return persisted;
  }

  const snippets = new Map<string, IntakeTimelineItem & { score: number; sourceLength: number }>();
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
        if (
          !/(due|draft|final|live|review|outline|submit|submission|timing|timeline)/i.test(
            candidate
          )
        ) {
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
          sourceLength: candidate.length,
        };
        const existing = snippets.get(key);

        if (
          !existing ||
          nextItem.score > existing.score ||
          (nextItem.score === existing.score && nextItem.sourceLength < existing.sourceLength)
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
      id: `timeline-${index + 1}`,
    }));
}

// fallow-ignore-next-line complexity
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
    const normalized = sanitizeDisplayText(value)?.replace(/\s{2,}/g, " ");
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

    const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim());

    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index] ?? "";
      if (!trimmed || trimmed.length > 120) {
        continue;
      }
      if (analyticsBoilerplatePattern.test(trimmed)) {
        continue;
      }

      const nextLine = lines.slice(index + 1).find((candidate) => candidate.length > 0) ?? null;

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

// fallow-ignore-next-line complexity
function inferContractTitle(
  aggregate: DealAggregate,
  brandName: string | null,
  agencyName: string | null,
  deliverables: DeliverableItem[]
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
    return combineBrandAndTitle(brandName, normalizedCampaign, agencyName);
  }

  const evidenceCampaign = sanitizeCampaignName(
    cleanExtractedLabel(bestEvidenceSnippet(aggregate.extractionEvidence, ["campaignName"]))
  );
  if (evidenceCampaign) {
    return combineBrandAndTitle(brandName, evidenceCampaign, agencyName);
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

      const combined = combineBrandAndTitle(brandName, candidate, agencyName);
      if (combined) {
        return combined;
      }
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

    const combinedSubject = combineBrandAndTitle(brandName, subject, agencyName);
    if (combinedSubject) {
      return combinedSubject;
    }

    const explicitCampaign = sanitizeCampaignName(
      primaryText.match(/^(?:campaign|project)\s*:\s*(.+)$/im)?.[1] ?? null
    );
    if (explicitCampaign) {
      return combineBrandAndTitle(brandName, explicitCampaign, agencyName);
    }
  }

  const derivedFileTitle = deriveWorkspaceTitleFromFileNames(
    aggregate.documents.map((document) => document.fileName)
  );
  const combinedFileTitle = combineBrandAndTitle(brandName, derivedFileTitle, agencyName);
  if (combinedFileTitle) {
    return combinedFileTitle;
  }

  const deliverableTitle = buildReadableDeliverableTitle(brandName, deliverables);
  if (deliverableTitle) {
    return deliverableTitle;
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

  return humanizeTitleCandidate(sanitizeCampaignName(aggregate.deal.campaignName));
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
        maximumFractionDigits: 2,
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
    ...input.aggregate.documents.slice(0, 2).map((document) => cleanFileName(document.fileName)),
  ];

  groups.push({
    id: "partnership",
    title: "Partnership",
    snippets: sanitizeDisplayList(partnershipSnippets).slice(0, 4),
  });

  const contactSnippets = [
    input.primaryContact.name,
    input.primaryContact.title,
    input.primaryContact.email,
    input.primaryContact.phone,
  ];

  const sanitizedContactSnippets = sanitizeDisplayList(contactSnippets);
  if (sanitizedContactSnippets.length > 0) {
    groups.push({
      id: "primary-contact",
      title: "Primary contact",
      snippets: sanitizedContactSnippets,
    });
  }

  const snapshotSnippets = [
    input.contractTitle,
    bestEvidenceSnippet(evidence, ["campaignName"]),
    bestEvidenceSnippet(evidence, ["paymentAmount"]),
  ];

  groups.push({
    id: "contract-snapshot",
    title: "Contract snapshot",
    snippets: sanitizeDisplayList(snapshotSnippets).slice(0, 4),
  });

  const intelligenceSnippets = [
    input.brandCategory ? input.brandCategory.replace(/_/g, " ") : null,
    ...input.disclosureObligations.map((entry) => entry.title),
  ];

  const sanitizedIntelligenceSnippets = sanitizeDisplayList(intelligenceSnippets);
  if (sanitizedIntelligenceSnippets.length > 0) {
    groups.push({
      id: "rights-and-disclosure",
      title: "Rights and disclosure",
      snippets: sanitizedIntelligenceSnippets.slice(0, 6),
    });
  }

  if (input.timelineItems.length > 0) {
    groups.push({
      id: "timeline",
      title: "Deliverables and timeline",
      snippets: sanitizeDisplayList(input.timelineItems.map((item) => item.source)).slice(0, 6),
    });
  }

  if ((input.analytics?.highlights?.length ?? 0) > 0) {
    groups.push({
      id: "analytics",
      title: "Audience and analytics",
      snippets: sanitizeDisplayList(input.analytics?.highlights ?? []).slice(0, 6),
    });
  }

  return groups.filter((group) => group.snippets.length > 0);
}

// fallow-ignore-next-line complexity
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
  const contractTitle = inferContractTitle(aggregate, brandName, agencyName, deliverables);
  const timelineItems = cleanTimelineItems(
    Array.isArray(persisted?.timelineItems) && persisted.timelineItems.length > 0
      ? persisted.timelineItems
      : extractTimelineItems(aggregate)
  );
  const analytics = cleanAnalytics(
    Array.isArray(persisted?.analytics?.highlights) && persisted.analytics.highlights.length > 0
      ? persisted.analytics
      : extractAnalytics(aggregate)
  );
  const brandCategory =
    persisted?.brandCategory ?? aggregate.terms?.brandCategory ?? inferBrandCategoryFromDocuments(aggregate);
  const competitorCategories = sanitizeDisplayList(
    Array.isArray(persisted?.competitorCategories) && persisted.competitorCategories.length > 0
      ? persisted.competitorCategories
      : (aggregate.terms?.competitorCategories ?? [])
  );
  const restrictedCategories = sanitizeDisplayList(
    Array.isArray(persisted?.restrictedCategories) && persisted.restrictedCategories.length > 0
      ? persisted.restrictedCategories
      : (aggregate.terms?.restrictedCategories ?? [])
  );
  const campaignDateWindow = cleanCampaignDateWindow(
    persisted?.campaignDateWindow ??
      aggregate.terms?.campaignDateWindow ??
      campaignWindowFromTimelineItems(timelineItems)
  );
  const disclosureObligations = cleanDisclosureObligations(
    Array.isArray(persisted?.disclosureObligations) && persisted.disclosureObligations.length > 0
      ? persisted.disclosureObligations
      : (aggregate.terms?.disclosureObligations ?? [])
  );
  const contractSummary =
    toPlainDealSummary(persisted?.contractSummary) ??
    buildContractSummary({
      brandName,
      agencyName,
      contractTitle,
      paymentAmount,
      currency: aggregate.terms?.currency ?? aggregate.paymentRecord?.currency ?? "USD",
      deliverables,
      timelineItems,
    }) ??
    toPlainDealSummary(aggregate.currentSummary?.body);

  const notes = sanitizeDisplayText(persisted?.notes) ?? sanitizeDisplayText(aggregate.terms?.notes);
  const evidenceGroups = buildEvidenceGroups({
    aggregate,
    brandName,
    agencyName,
    primaryContact,
    contractTitle,
    timelineItems,
    brandCategory,
    disclosureObligations,
    analytics,
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
      deliverables.reduce((count, item) => count + (item.quantity ?? 1), 0) || deliverables.length,
    deliverables,
    timelineItems,
    brandCategory,
    competitorCategories,
    restrictedCategories,
    campaignDateWindow,
    disclosureObligations,
    analytics,
    notes,
    evidenceGroups,
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
    version: INTAKE_NORMALIZED_VERSION,
  };
}
