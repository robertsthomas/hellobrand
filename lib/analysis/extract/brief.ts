/**
 * Heuristic extraction helpers for brief-like documents.
 * This file handles brand and campaign inference plus brief deliverable detection.
 */
import { randomUUID } from "node:crypto";

import { sanitizeCampaignName, sanitizePartyName } from "@/lib/party-labels";
import type { DeliverableItem, DocumentKind, FieldEvidence } from "@/lib/types";

import { getTopDocumentLines, isGenericCampaignName, pushEvidence, sentenceAround } from "./shared";

export function inferBriefBrandName(text: string) {
  for (const line of getTopDocumentLines(text, 4)) {
    const candidate = sanitizePartyName(
      line
        .replace(/\b(influencer|campaign|creative|content)\s+brief\b/gi, "")
        .replace(/\bbrief\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
      "brand"
    );
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

export function shouldUseInferredBriefBrandName(
  currentBrandName: string | null | undefined,
  inferredBrandName: string | null | undefined
) {
  if (!inferredBrandName) {
    return false;
  }

  if (!currentBrandName) {
    return true;
  }

  const current = currentBrandName.trim().toLowerCase();
  const inferredTokens = inferredBrandName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (
    /hook|second|requirement|guideline|messaging|concept|campaign|project|workspace|brief|overview|usage|rights|payment|deliverables|timeline|summary|general/.test(current) ||
    current.length > 40
  ) {
    return true;
  }

  return !inferredTokens.some((token) => current.includes(token));
}

export function inferBriefCampaignName(text: string, fileName?: string | null) {
  const topLines = getTopDocumentLines(text, 4);
  const inferredBrandName = inferBriefBrandName(text)?.toLowerCase() ?? null;

  for (const line of topLines.slice(1)) {
    if (
      line.length > 2 &&
      line.length < 100 &&
      line.toLowerCase() !== inferredBrandName &&
      sanitizeCampaignName(line)
    ) {
      return sanitizeCampaignName(line);
    }
  }

  if (!fileName) {
    return null;
  }

  const stem = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const afterBrief = stem.match(/\bbrief\b\s+(.+)$/i)?.[1]?.trim();
  return sanitizeCampaignName(afterBrief ?? null);
}

export function parseBriefDeliverables(text: string, evidence: FieldEvidence[]) {
  const deliverables: DeliverableItem[] = [];
  const seen = new Set<string>();
  const patterns = [
    {
      pattern: /\big\s+reel\s+or\s+tiktok\b/i,
      title: "IG Reel or TikTok",
      channel: "Instagram/TikTok"
    },
    {
      pattern: /\b(?:ig|instagram)\s+story\b/i,
      title: "IG Story",
      channel: "Instagram"
    },
    {
      pattern: /\b(?:tiktok|tik tok)\b/i,
      title: "TikTok",
      channel: "TikTok"
    }
  ];

  for (const { pattern, title, channel } of patterns) {
    const match = pattern.exec(text);
    if (!match || seen.has(title)) {
      continue;
    }

    const index = match.index ?? 0;
    deliverables.push({
      id: randomUUID(),
      title,
      dueDate: null,
      channel,
      quantity: 1,
      status: "pending",
      description: sentenceAround(text, index)
    });
    seen.add(title);
    pushEvidence(
      evidence,
      "deliverables",
      sentenceAround(text, index),
      null,
      0.72
    );
  }

  return deliverables;
}
export function isBriefLikeDocumentKind(documentKind: DocumentKind) {
  return (
    documentKind === "campaign_brief" ||
    documentKind === "deliverables_brief" ||
    documentKind === "pitch_deck"
  );
}
