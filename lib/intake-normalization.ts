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
import { toPlainDealSummary } from "@/lib/deal-summary";

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

function cleanExtractedLabel(value: string | null | undefined) {
  const normalized = presentText(value);
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

function cleanFileName(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+x\s+/gi, " x ")
    .replace(/\b(agreement|contract|term sheet|msa|sow|scope of work)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isGenericIntakeLabel(value: string | null | undefined) {
  const normalized = presentText(value)?.toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized === "pasted email thread" ||
    normalized === "pasted deliverables notes" ||
    normalized === "pasted invoice" ||
    normalized === "pasted contract" ||
    normalized === "pasted campaign brief" ||
    normalized === "pasted context" ||
    normalized === "email thread" ||
    normalized === "campaign brief" ||
    normalized === "contract" ||
    normalized === "context" ||
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

function extractPrimaryContact(
  aggregate: DealAggregate,
  agencyName: string | null,
  brandName: string | null
): IntakePrimaryContact {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.primaryContact;
  if (persisted) {
    return {
      organizationType: persisted.organizationType ?? (agencyName ? "agency" : "brand"),
      name: presentText(persisted.name),
      title: presentText(persisted.title),
      email: presentText(persisted.email),
      phone: presentText(persisted.phone)
    };
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
    const emailIndex = emails.length
      ? lines.findIndex((line) => line.includes(emails[0]))
      : -1;
    const windowStart = emailIndex === -1 ? Math.max(lines.length - 8, 0) : Math.max(0, emailIndex - 4);
    const windowEnd = emailIndex === -1 ? lines.length : Math.min(lines.length, emailIndex + 4);
    const windowLines = lines.slice(windowStart, windowEnd);
    const nameLine =
      [...windowLines]
        .sort((left, right) => scoreContactLine(right) - scoreContactLine(left))
        .find((line) => /^[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3}$/.test(line)) ?? null;
    const titleLine =
      windowLines.find((line) =>
        /manager|director|partnership|campaign|media|marketing|talent|agent|coordinator/i.test(
          line
        )
      ) ?? null;

    if (emails[0] || phones[0] || nameLine || titleLine) {
      return {
        organizationType: agencyName ? "agency" : brandName ? "brand" : null,
        name: presentText(nameLine),
        title: presentText(titleLine),
        email: presentText(emails[0] ?? null),
        phone: presentText(phones[0] ?? null)
      };
    }
  }

  return {
    organizationType: agencyName ? "agency" : brandName ? "brand" : null,
    name: null,
    title: null,
    email: null,
    phone: null
  };
}

function extractLikelyBrandFromFileNames(fileNames: string[]) {
  for (const fileName of fileNames) {
    const cleaned = cleanFileName(fileName);
    if (!cleaned || isGenericIntakeLabel(cleaned)) {
      continue;
    }

    const beforeHandle = cleaned.split(/\s+@\w+/i)[0]?.trim();
    if (beforeHandle) {
      return beforeHandle.replace(/\s+x\s*$/i, "").trim();
    }

    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function extractBrandFromText(text: string) {
  const directPatterns = [
    /on behalf of our client\s+[–-]\s*([A-Z][A-Za-z0-9&+.' -]+)/i,
    /for\s+([A-Z][A-Za-z0-9&+.' -]{2,40})\s+at\s+[A-Z]/i,
    /join\s+([A-Z][A-Za-z0-9&+.' -]{2,40})'?s affiliate program/i,
    /deliverables?:.*featuring\s+([A-Z][A-Za-z0-9&+.' -]+)/i,
    /^([A-Z][A-Za-z0-9&+.' -]{2,60})\n(?:we are looking|deliverables:)/im
  ];

  for (const pattern of directPatterns) {
    const match = text.match(pattern);
    const candidate = cleanExtractedLabel(match?.[1] ?? null);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function inferBrandName(aggregate: DealAggregate) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.brandName;
  if (persisted && !isGenericIntakeLabel(persisted)) {
    return presentText(persisted);
  }

  const termsBrand = cleanExtractedLabel(aggregate.terms?.brandName);
  if (termsBrand && !/^client\b/i.test(termsBrand)) {
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
    const cleaned = cleanExtractedLabel(evidenceSnippet);
    if (cleaned && !isGenericIntakeLabel(cleaned)) {
      return cleaned;
    }
  }

  const dealBrand = presentText(aggregate.deal.brandName);
  return dealBrand && !isGenericIntakeLabel(dealBrand) ? dealBrand : null;
}

function inferAgencyName(aggregate: DealAggregate, brandName: string | null) {
  const persisted = getPersistedIntakeRecord(aggregate.summaries)?.agencyName;
  if (persisted) {
    return presentText(persisted);
  }

  const direct = cleanExtractedLabel(aggregate.terms?.agencyName);
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
    const candidate = cleanExtractedLabel(signatureMatch);
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
        Boolean(value) &&
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

  const highlights = new Set<string>();
  const analyticsDocumentPattern =
    /\b(total viewers|average watch time|watched full video|new followers|traffic sources|top locations|retention rate|performance|viewers)\b/i;
  const analyticsLinePattern =
    /\b(total viewers|average watch time|watched full video|new followers|traffic sources|top locations|retention rate|for you|following|personal profile|female|male|18-24|25-34|35-44|45-54|55\+)\b/i;
  const analyticsMetricPattern =
    /(?:\b\d+(?:\.\d+)?%\b|\b\d+(?:\.\d+)?s\b|\b\d+(?:\.\d+)?[kKmM]\b|\b\d{1,3}(?:,\d{3})+\b)/;
  const analyticsBoilerplatePattern =
    /\b(manager\/agency|agreement|term of agreement|usage term|usage platforms|document ref|company|talent manager|services and deliverables)\b/i;

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

    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.replace(/\s+/g, " ").trim();
      if (!trimmed || trimmed.length > 120) {
        continue;
      }
      if (analyticsBoilerplatePattern.test(trimmed)) {
        continue;
      }
      if (
        analyticsLinePattern.test(trimmed) &&
        (analyticsMetricPattern.test(trimmed) ||
          /\b(gender|age|traffic sources|top locations|retention rate)\b/i.test(trimmed))
      ) {
        highlights.add(trimmed.replace(/\s{2,}/g, " "));
      }
    }
  }

  return highlights.size > 0 ? { highlights: Array.from(highlights).slice(0, 5) } : null;
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
  if (
    campaign &&
    !/\bname\b/i.test(aggregate.terms?.campaignName ?? "") &&
    !isGenericIntakeLabel(campaign)
  ) {
    return brandName && !campaign.toLowerCase().includes(brandName.toLowerCase())
      ? `${brandName} - ${campaign}`
      : campaign;
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

    const explicitCampaign = presentText(
      primaryText.match(/^(?:campaign|project)\s*:\s*(.+)$/im)?.[1] ?? null
    );
    if (explicitCampaign && !isGenericIntakeLabel(explicitCampaign)) {
      return brandName && !explicitCampaign.toLowerCase().includes(brandName.toLowerCase())
        ? `${brandName} - ${explicitCampaign}`
        : explicitCampaign;
    }
  }

  const fileName = aggregate.documents[0]?.fileName;
  if (fileName) {
    const cleaned = cleanFileName(fileName);
    if (cleaned && !isGenericIntakeLabel(cleaned)) {
      return cleaned;
    }
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

  const fallbackCampaign = presentText(aggregate.deal.campaignName);
  return fallbackCampaign && !isGenericIntakeLabel(fallbackCampaign) ? fallbackCampaign : null;
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
  aggregate: DealAggregate | null
): NormalizedIntakeRecord | null {
  if (!aggregate) {
    return null;
  }

  const persisted = getPersistedIntakeRecord(aggregate.summaries);
  const brandName = inferBrandName(aggregate);
  const agencyName = inferAgencyName(aggregate, brandName);
  const primaryContact = extractPrimaryContact(aggregate, agencyName, brandName);
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
