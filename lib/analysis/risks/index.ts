/**
 * Heuristic (non-LLM) creator risk analysis.
 */
import type {
  ExtractionPipelineResult,
  RiskFlagRecord
} from "@/lib/types";

function sentenceAround(text: string, index: number) {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  const nextPeriod = text.indexOf(".", index);
  const end = nextPeriod === -1 ? text.length : nextPeriod + 1;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function analyzeCreatorRisks(
  text: string,
  documentId: string,
  extraction: ExtractionPipelineResult
) {
  const risks: Array<Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">> = [];
  const lower = text.toLowerCase();
  const deliverables = Array.isArray(extraction.data.deliverables)
    ? extraction.data.deliverables
    : [];

  if ((extraction.data.netTermsDays ?? 0) >= 45) {
    risks.push({
      category: "payment_terms",
      title: "Long payment window",
      detail:
        "The contract appears to delay payment longer than many creator deals.",
      severity: "medium",
      suggestedAction: "Ask whether payment can be shortened to Net 15 or Net 30.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "paymentTerms")
        .map((entry) => entry.snippet),
      sourceDocumentId: documentId
    });
  }

  if (/perpetual/.test(lower)) {
    risks.push({
      category: "usage_rights",
      title: "Perpetual usage rights",
      detail:
        "The brand appears to receive unlimited-duration rights to use your content or likeness.",
      severity: "high",
      suggestedAction: "Limit usage to a fixed term and define where it can run.",
      evidence: [sentenceAround(text, lower.indexOf("perpetual"))],
      sourceDocumentId: documentId
    });
  }

  if (extraction.data.usageRightsPaidAllowed) {
    risks.push({
      category: "usage_rights",
      title: "Paid usage included",
      detail:
        "The agreement appears to allow paid usage or ad rights without clearly separated compensation.",
      severity: "high",
      suggestedAction:
        "Confirm channels, duration, and added compensation for paid usage.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "usageRights")
        .map((entry) => entry.snippet),
      sourceDocumentId: documentId
    });
  }

  if ((extraction.data.exclusivityApplies ?? false) && extraction.data.exclusivityDuration) {
    risks.push({
      category: "exclusivity",
      title: "Exclusivity restrictions present",
      detail:
        "The deal appears to limit competitive partnerships, which may block future paid work.",
      severity: "medium",
      suggestedAction: "Reduce the category scope or shorten the exclusivity period.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "exclusivity")
        .map((entry) => entry.snippet),
      sourceDocumentId: documentId
    });
  }

  if (deliverables.length === 0 || /to be agreed|as requested|tbd/i.test(lower)) {
    risks.push({
      category: "deliverables",
      title: "Deliverables may be vague",
      detail:
        "The exact content requirements may be too open-ended for a smooth campaign workflow.",
      severity: "medium",
      suggestedAction: "Ask for a defined list of assets, platforms, and approval rounds.",
      evidence: extraction.evidence
        .filter((entry) => entry.fieldPath === "deliverables")
        .map((entry) => entry.snippet)
        .slice(0, 1),
      sourceDocumentId: documentId
    });
  }

  if (/sole discretion|without cause|terminate immediately/i.test(lower)) {
    risks.push({
      category: "termination",
      title: "One-sided termination language",
      detail:
        "The brand may be able to cancel more easily than the creator, which can put compensation at risk.",
      severity: "medium",
      suggestedAction:
        "Request notice requirements and protection for work already completed.",
      evidence: [sentenceAround(text, Math.max(lower.indexOf("terminate"), 0))],
      sourceDocumentId: documentId
    });
  }

  if (risks.length === 0) {
    risks.push({
      category: "other",
      title: "Manual review still recommended",
      detail:
        "No major creator-specific watchouts were confidently detected, but you should still confirm scope, timing, and usage before signing.",
      severity: "low",
      suggestedAction: "Double-check deliverables, payment timing, and rights granted.",
      evidence: [],
      sourceDocumentId: documentId
    });
  }

  return risks;
}
