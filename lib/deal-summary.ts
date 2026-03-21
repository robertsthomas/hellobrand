export interface DealSummarySection {
  id: string;
  title: string;
  paragraphs: string[];
}

const CANONICAL_SECTIONS = [
  "What this partnership is",
  "What you deliver",
  "What you get paid",
  "Rights and restrictions",
  "Watchouts"
] as const;

function presentText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canonicalizeSectionTitle(raw: string) {
  const cleaned = stripInlineMarkdown(raw).toLowerCase();

  for (const title of CANONICAL_SECTIONS) {
    if (cleaned.includes(title.toLowerCase())) {
      return title;
    }
  }

  return raw.trim() || "Overview";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "overview";
}

export function stripInlineMarkdown(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[_*`>#]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function cleanParagraph(value: string) {
  return stripInlineMarkdown(
    value
      .replace(/^[\s\-*•]+/gm, "")
      .replace(/^overview:\s*/gim, "")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
  );
}

function prepareForSectionParsing(value: string) {
  let next = value.replace(/\r/g, "\n");

  for (const title of CANONICAL_SECTIONS) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(
      new RegExp(`\\s*(#{1,6}\\s*${escaped}\\b)`, "gi"),
      "\n$1"
    );
    next = next.replace(
      new RegExp(`\\s*(${escaped})\\s*:`, "gi"),
      "\n## $1\n"
    );
  }

  return next;
}

export function parseDealSummarySections(body: string | null | undefined) {
  const normalized = presentText(body);
  if (!normalized) {
    return [] as DealSummarySection[];
  }

  const prepared = prepareForSectionParsing(normalized);
  const headingRegex =
    /#{1,6}\s*(What this partnership is|What you deliver|What you get paid|Rights and restrictions|Watchouts)\b/gi;
  const matches = [...prepared.matchAll(headingRegex)];

  if (matches.length === 0) {
    const paragraph = cleanParagraph(prepared);
    return paragraph
      ? [
          {
            id: "overview",
            title: "Overview",
            paragraphs: [paragraph]
          }
        ]
      : [];
  }

  const sections: DealSummarySection[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const title = canonicalizeSectionTitle(current[1] ?? current[0]);
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? prepared.length;
    const rawContent = prepared.slice(start, end).trim().replace(/^[:\-\s]+/, "");

    const paragraphs = rawContent
      .split(/\n{2,}/)
      .map((entry) => cleanParagraph(entry))
      .filter(Boolean);

    if (paragraphs.length === 0) {
      continue;
    }

    if (sections.some((section) => section.title === title)) {
      const existing = sections.find((section) => section.title === title);
      if (!existing) {
        continue;
      }

      for (const paragraph of paragraphs) {
        if (!existing.paragraphs.includes(paragraph)) {
          existing.paragraphs.push(paragraph);
        }
      }
      continue;
    }

    sections.push({
      id: slugify(title),
      title,
      paragraphs
    });
  }

  return sections;
}

export function serializeDealSummarySections(sections: DealSummarySection[]) {
  return sections
    .map((section) => `${section.title}: ${section.paragraphs.join(" ")}`.trim())
    .join("\n\n");
}

export function toPlainDealSummary(body: string | null | undefined) {
  const sections = parseDealSummarySections(body);
  if (sections.length > 0) {
    return serializeDealSummarySections(sections);
  }

  return typeof body === "string" && presentText(body) ? cleanParagraph(body) : null;
}
