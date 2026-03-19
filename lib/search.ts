import { prisma } from "@/lib/prisma";
import type { Viewer } from "@/lib/types";

export type SearchResultKind =
  | "deal"
  | "document"
  | "terms"
  | "risk"
  | "section"
  | "summary";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  dealId: string;
  dealName: string;
  brandName: string;
  title: string;
  snippet: string;
  matchedField: string;
  score: number;
  updatedAt: string;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyScore(query: string, text: string): number {
  if (!text) return 0;
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;

  // Exact substring match
  if (t.includes(q)) return 100;

  // Word-level matching
  const qWords = q.split(" ");
  const matched = qWords.filter((w) => t.includes(w));
  if (matched.length === 0) return 0;

  const wordScore = (matched.length / qWords.length) * 80;

  // Boost for match at start
  const startsBonus = t.startsWith(q.split(" ")[0]) ? 10 : 0;

  return wordScore + startsBonus;
}

function excerpt(text: string, query: string, maxLen = 200): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const q = normalize(query).split(" ")[0];
  const idx = lower.indexOf(q);

  if (idx === -1) return text.slice(0, maxLen);

  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + maxLen - 60);
  const slice = text.slice(start, end).trim();

  return (start > 0 ? "..." : "") + slice + (end < text.length ? "..." : "");
}

export async function searchForViewer(
  viewer: Viewer,
  query: string
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const q = query.trim();
  const results: SearchResult[] = [];

  // Load all confirmed deals with their relations in one query
  const deals = await prisma.deal.findMany({
    where: { userId: viewer.id, confirmedAt: { not: null } },
    include: {
      terms: true,
      documents: {
        select: {
          id: true,
          fileName: true,
          normalizedText: true,
          documentKind: true,
          updatedAt: true
        }
      },
      riskFlags: {
        select: { id: true, title: true, detail: true, severity: true, createdAt: true }
      },
      summaries: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { id: true, body: true, createdAt: true }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  for (const deal of deals) {
    const dealName = deal.campaignName;
    const brandName = deal.brandName;

    // Score deal-level fields
    const dealFields: { field: string; value: string | null }[] = [
      { field: "brandName", value: deal.brandName },
      { field: "campaignName", value: deal.campaignName },
      { field: "summary", value: deal.summary }
    ];

    for (const { field, value } of dealFields) {
      if (!value) continue;
      const score = fuzzyScore(q, value);
      if (score > 0) {
        results.push({
          id: `deal-${deal.id}-${field}`,
          kind: "deal",
          dealId: deal.id,
          dealName,
          brandName,
          title: dealName,
          snippet: excerpt(value, q),
          matchedField: field,
          score: score + (field === "campaignName" ? 20 : field === "brandName" ? 15 : 0),
          updatedAt: deal.updatedAt.toISOString()
        });
      }
    }

    // Score terms fields
    if (deal.terms) {
      const termsFields: { field: string; value: string | null }[] = [
        { field: "agencyName", value: deal.terms.agencyName },
        { field: "creatorName", value: deal.terms.creatorName },
        { field: "paymentTerms", value: deal.terms.paymentTerms },
        { field: "paymentStructure", value: deal.terms.paymentStructure },
        { field: "paymentTrigger", value: deal.terms.paymentTrigger },
        { field: "usageRights", value: deal.terms.usageRights },
        { field: "exclusivity", value: deal.terms.exclusivity },
        { field: "exclusivityRestrictions", value: deal.terms.exclusivityRestrictions },
        { field: "termination", value: deal.terms.termination },
        { field: "terminationConditions", value: deal.terms.terminationConditions },
        { field: "governingLaw", value: deal.terms.governingLaw },
        { field: "notes", value: deal.terms.notes }
      ];

      for (const { field, value } of termsFields) {
        if (!value) continue;
        const score = fuzzyScore(q, value);
        if (score > 0) {
          results.push({
            id: `terms-${deal.id}-${field}`,
            kind: "terms",
            dealId: deal.id,
            dealName,
            brandName,
            title: `${dealName} — ${humanize(field)}`,
            snippet: excerpt(value, q),
            matchedField: field,
            score,
            updatedAt: deal.updatedAt.toISOString()
          });
        }
      }
    }

    // Score documents
    for (const doc of deal.documents) {
      // File name match
      const fnScore = fuzzyScore(q, doc.fileName);
      if (fnScore > 0) {
        results.push({
          id: `doc-${doc.id}-fileName`,
          kind: "document",
          dealId: deal.id,
          dealName,
          brandName,
          title: doc.fileName,
          snippet: doc.fileName,
          matchedField: "fileName",
          score: fnScore + 5,
          updatedAt: doc.updatedAt.toISOString()
        });
      }

      // Document text match
      if (doc.normalizedText) {
        const textScore = fuzzyScore(q, doc.normalizedText);
        if (textScore > 0) {
          results.push({
            id: `doc-${doc.id}-text`,
            kind: "document",
            dealId: deal.id,
            dealName,
            brandName,
            title: doc.fileName,
            snippet: excerpt(doc.normalizedText, q, 250),
            matchedField: "documentText",
            score: textScore - 5,
            updatedAt: doc.updatedAt.toISOString()
          });
        }
      }
    }

    // Score risk flags
    for (const risk of deal.riskFlags) {
      const titleScore = fuzzyScore(q, risk.title);
      const detailScore = risk.detail ? fuzzyScore(q, risk.detail) : 0;
      const bestScore = Math.max(titleScore, detailScore);
      if (bestScore > 0) {
        results.push({
          id: `risk-${risk.id}`,
          kind: "risk",
          dealId: deal.id,
          dealName,
          brandName,
          title: `${risk.severity === "high" ? "High risk" : "Risk"}: ${risk.title}`,
          snippet: excerpt(risk.detail ?? risk.title, q),
          matchedField: titleScore >= detailScore ? "title" : "detail",
          score: bestScore,
          updatedAt: risk.createdAt.toISOString()
        });
      }
    }

    // Score summaries
    for (const summary of deal.summaries) {
      const score = fuzzyScore(q, summary.body);
      if (score > 0) {
        results.push({
          id: `summary-${summary.id}`,
          kind: "summary",
          dealId: deal.id,
          dealName,
          brandName,
          title: `${dealName} — Summary`,
          snippet: excerpt(summary.body, q, 250),
          matchedField: "summary",
          score: score - 3,
          updatedAt: summary.createdAt.toISOString()
        });
      }
    }
  }

  // If we also want to search document sections for more granular results
  if (results.length < 20) {
    const dealIds = deals.map((d) => d.id);
    const docIds = deals.flatMap((d) => d.documents.map((doc) => doc.id));

    if (docIds.length > 0) {
      const sections = await prisma.documentSection.findMany({
        where: { documentId: { in: docIds } },
        select: {
          id: true,
          documentId: true,
          title: true,
          content: true,
          chunkIndex: true,
          createdAt: true,
          document: {
            select: { dealId: true, fileName: true }
          }
        }
      });

      for (const section of sections) {
        const score = Math.max(
          fuzzyScore(q, section.title),
          fuzzyScore(q, section.content)
        );
        if (score <= 0) continue;

        const deal = deals.find((d) => d.id === section.document.dealId);
        if (!deal) continue;

        results.push({
          id: `section-${section.id}`,
          kind: "section",
          dealId: deal.id,
          dealName: deal.campaignName,
          brandName: deal.brandName,
          title: `${section.document.fileName} — ${section.title}`,
          snippet: excerpt(section.content, q, 250),
          matchedField: "sectionContent",
          score: score - 8,
          updatedAt: section.createdAt.toISOString()
        });
      }
    }
  }

  // Deduplicate by keeping highest score per deal+kind combo
  const seen = new Map<string, SearchResult>();
  for (const result of results) {
    const key = `${result.dealId}:${result.kind}:${result.matchedField}`;
    const existing = seen.get(key);
    if (!existing || result.score > existing.score) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

function humanize(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
