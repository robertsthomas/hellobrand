import { afterEach, describe, expect, test, vi } from "vitest";

import { buildGeneratedSummaryVariant, validateSummaryVariantBody } from "@/lib/summary-variants";
import * as llmModule from "@/lib/analysis/llm";
import {
  getCurrentWorkspaceSummary,
  getLatestSummaryByType,
  normalizeSummaryRecord
} from "@/lib/summaries";
import { createSeedStore } from "@/lib/repository/seed";
import type { DealAggregate } from "@/lib/types";

function createAggregate(): DealAggregate {
  const seed = createSeedStore();

  return {
    deal: seed.deals[0],
    latestDocument: seed.documents[0],
    documents: seed.documents,
    terms: seed.dealTerms[0],
    conflictResults: [],
    paymentRecord: null,
    invoiceRecord: null,
    riskFlags: seed.riskFlags,
    emailDrafts: seed.emailDrafts,
    jobs: seed.jobs,
    documentSections: seed.documentSections,
    extractionResults: seed.extractionResults,
    extractionEvidence: seed.extractionEvidence,
    summaries: seed.summaries,
    currentSummary: seed.summaries[0],
    intakeSession: null
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("summary history", () => {
  test("backfills legacy workspace summaries as legal summaries", () => {
    const summary = normalizeSummaryRecord({
      id: "summary-legacy",
      dealId: "deal-1",
      documentId: "doc-1",
      body: "Legacy summary",
      version: "v1",
      createdAt: new Date().toISOString()
    });

    expect(summary.summaryType).toBe("legal");
    expect(summary.source).toBe("analysis");
    expect(summary.isCurrent).toBe(false);
  });

  test("keeps intake-normalized summaries out of workspace history", () => {
    const legal = normalizeSummaryRecord({
      id: "summary-legal",
      dealId: "deal-1",
      documentId: "doc-1",
      body: "Legal summary",
      version: "v1",
      createdAt: "2026-03-26T00:00:00.000Z",
      isCurrent: true
    });
    const intake = normalizeSummaryRecord({
      id: "summary-intake",
      dealId: "deal-1",
      documentId: null,
      body: "{\"brandName\":\"Brand\"}",
      version: "intake-normalized:v1",
      createdAt: "2026-03-26T01:00:00.000Z"
    });

    expect(getCurrentWorkspaceSummary([intake, legal])?.id).toBe("summary-legal");
  });

  test("returns the latest summary for a requested type", () => {
    const currentLegal = normalizeSummaryRecord({
      id: "summary-legal-new",
      dealId: "deal-1",
      documentId: "doc-2",
      body: "New legal summary",
      version: "llm:gpt",
      summaryType: "legal",
      source: "analysis",
      parentSummaryId: null,
      isCurrent: true,
      createdAt: "2026-03-26T02:00:00.000Z"
    });
    const olderPlain = normalizeSummaryRecord({
      id: "summary-plain-old",
      dealId: "deal-1",
      documentId: "doc-1",
      body: "Old plain summary",
      version: "llm:plain",
      summaryType: "plain_language",
      source: "simplification",
      parentSummaryId: "summary-legal-old",
      isCurrent: false,
      createdAt: "2026-03-25T02:00:00.000Z"
    });
    const newerPlain = normalizeSummaryRecord({
      id: "summary-plain-new",
      dealId: "deal-1",
      documentId: "doc-2",
      body: "New plain summary",
      version: "llm:plain",
      summaryType: "plain_language",
      source: "simplification",
      parentSummaryId: "summary-legal-new",
      isCurrent: false,
      createdAt: "2026-03-26T03:00:00.000Z"
    });

    expect(getLatestSummaryByType([olderPlain, newerPlain, currentLegal], "plain_language")?.id).toBe(
      "summary-plain-new"
    );
  });

  test("builds a fallback simplified summary that keeps canonical sections", async () => {
    const aggregate = createAggregate();
    const result = await buildGeneratedSummaryVariant({
      aggregate,
      baseSummary: aggregate.summaries[0],
      targetType: "plain_language"
    });

    expect(result.summaryType).toBe("plain_language");
    expect(result.parentSummaryId).toBe(aggregate.summaries[0].id);
    expect(validateSummaryVariantBody(aggregate, result.body)).toBeNull();
  });

  test("falls back when simplified summary generation is budget-blocked", async () => {
    const aggregate = createAggregate();
    vi.spyOn(llmModule, "hasLlmKey").mockReturnValue(true);
    vi.spyOn(llmModule, "generateSimplifiedSummaryWithLlm").mockRejectedValueOnce(
      new Error("LLM budget limit reached.")
    );

    const result = await buildGeneratedSummaryVariant({
      aggregate,
      baseSummary: aggregate.summaries[0],
      targetType: "plain_language"
    });

    expect(result.summaryType).toBe("plain_language");
    expect(result.source).toBe("simplification");
    expect(result.version).toBe("fallback:plain_language");
    expect(validateSummaryVariantBody(aggregate, result.body)).toBeNull();

  });

  test("blocks simplified summaries that lose the payment amount", () => {
    const aggregate = createAggregate();
    const invalidBody = `
What this partnership is: Partnership with the brand.

What you deliver: One Instagram Reel and two Story frames.

What you get paid: Payment details are listed in the contract.

Rights and restrictions: Paid usage is allowed for six months.

Watchouts: Perpetual usage rights could expand beyond what you expect.
`;

    expect(validateSummaryVariantBody(aggregate, invalidBody)).toBe(
      "The simplified summary dropped the payment amount."
    );
  });
});
