import { createHash } from "node:crypto";

import { normalizeDocumentText } from "@/lib/documents/extract";
import {
  extractBrandFromText,
  extractBrandFromFileName,
  normalizeBrand
} from "@/lib/intake-clustering";
import { getRepository } from "@/lib/repository";
import type { DealRecord, DocumentRecord } from "@/lib/types";

export interface DuplicateMatch {
  dealId: string;
  brandName: string;
  campaignName: string;
  status: DealRecord["status"];
  matchScore: number;
  matchReason: "exact_content" | "same_brand_and_terms" | "similar_content";
  matchedDocumentIds: string[];
}

interface DealWithDocText {
  deal: Pick<DealRecord, "id" | "brandName" | "campaignName" | "status">;
  documents: Array<Pick<DocumentRecord, "id" | "normalizedText" | "rawText">>;
}

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function extractAmounts(text: string): number[] {
  const matches = text.match(/\$[\d,]+(?:\.\d{2})?/g) ?? [];
  return matches
    .map((m) => parseFloat(m.replace(/[$,]/g, "")))
    .filter((n) => !isNaN(n) && n > 0);
}

function extractDates(text: string): string[] {
  const patterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi
  ];
  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) results.push(...matches);
  }
  return results;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const token of smaller) {
    if (larger.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function buildTextTokens(text: string | null): Set<string> {
  if (!text) return new Set();
  const truncated = text.slice(0, 5000);
  return tokenize(truncated);
}

async function loadDealsWithDocumentText(userId: string): Promise<DealWithDocText[]> {
  const repository = getRepository();
  const deals = await repository.listDeals(userId);
  const results: DealWithDocText[] = [];

  for (const deal of deals.slice(0, 50)) {
    const documents = await repository.listDocuments(userId, deal.id);
    results.push({
      deal: {
        id: deal.id,
        brandName: deal.brandName,
        campaignName: deal.campaignName,
        status: deal.status
      },
      documents: documents.map((doc) => ({
        id: doc.id,
        normalizedText: doc.normalizedText,
        rawText: doc.rawText
      }))
    });
  }

  return results;
}

// fallow-ignore-next-line complexity
export async function findDuplicateDeals(
  userId: string,
  input: {
    rawTexts: string[];
    fileNames?: string[];
    brandNameHint?: string | null;
  }
): Promise<DuplicateMatch[]> {
  if (input.rawTexts.length === 0) return [];

  const existingDeals = await loadDealsWithDocumentText(userId);
  if (existingDeals.length === 0) return [];

  const incomingHashes = new Set<string>();
  const incomingBrands: string[] = [];
  const incomingAmounts: number[] = [];
  const incomingDates: string[] = [];
  const incomingTokenSets: Set<string>[] = [];

  for (let i = 0; i < input.rawTexts.length; i++) {
    const raw = input.rawTexts[i];
    const normalized = normalizeDocumentText(raw);
    incomingHashes.add(contentHash(normalized));

    const brand =
      input.brandNameHint ??
      extractBrandFromText(raw) ??
      (input.fileNames?.[i] ? extractBrandFromFileName(input.fileNames[i]) : null);
    if (brand) incomingBrands.push(brand);

    incomingAmounts.push(...extractAmounts(raw));
    incomingDates.push(...extractDates(raw));
    incomingTokenSets.push(buildTextTokens(normalized));
  }

  const normalizedIncomingBrands = new Set(incomingBrands.map(normalizeBrand).filter(Boolean));
  const matches: DuplicateMatch[] = [];

  for (const existing of existingDeals) {
    let bestScore = 0;
    let bestReason: DuplicateMatch["matchReason"] = "similar_content";
    const matchedDocIds: string[] = [];

    for (const doc of existing.documents) {
      const docText = doc.normalizedText ?? doc.rawText;
      if (!docText) continue;

      const docHash = contentHash(normalizeDocumentText(docText));
      if (incomingHashes.has(docHash)) {
        bestScore = 1.0;
        bestReason = "exact_content";
        matchedDocIds.push(doc.id);
        break;
      }

      const docTokens = buildTextTokens(docText);
      for (const incomingTokens of incomingTokenSets) {
        const similarity = jaccardSimilarity(incomingTokens, docTokens);
        if (similarity > bestScore) {
          bestScore = similarity;
          bestReason = "similar_content";
          if (matchedDocIds.indexOf(doc.id) === -1) matchedDocIds.push(doc.id);
        }
      }
    }

    if (bestScore < 1.0) {
      const existingBrandNorm = normalizeBrand(existing.deal.brandName);
      const brandMatches = normalizedIncomingBrands.has(existingBrandNorm);

      if (brandMatches) {
        const existingAmounts: number[] = [];
        const existingDates: string[] = [];
        for (const doc of existing.documents) {
          const text = doc.normalizedText ?? doc.rawText ?? "";
          existingAmounts.push(...extractAmounts(text));
          existingDates.push(...extractDates(text));
        }

        const amountOverlap = incomingAmounts.some((a) =>
          existingAmounts.some((b) => Math.abs(a - b) / Math.max(a, b) < 0.05)
        );
        const dateOverlap = incomingDates.some((d) => existingDates.includes(d));

        if (amountOverlap || dateOverlap) {
          const brandScore = 0.8;
          if (brandScore > bestScore) {
            bestScore = brandScore;
            bestReason = "same_brand_and_terms";
          }
        } else if (brandMatches) {
          const brandOnlyScore = 0.5;
          if (brandOnlyScore > bestScore) {
            bestScore = brandOnlyScore;
            bestReason = "same_brand_and_terms";
          }
        }
      }
    }

    if (bestScore >= 0.4) {
      matches.push({
        dealId: existing.deal.id,
        brandName: existing.deal.brandName,
        campaignName: existing.deal.campaignName,
        status: existing.deal.status,
        matchScore: Math.round(bestScore * 100) / 100,
        matchReason: bestReason,
        matchedDocumentIds: matchedDocIds
      });
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}
