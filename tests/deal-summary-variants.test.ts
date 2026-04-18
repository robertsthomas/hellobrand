import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildGeneratedSummaryVariantMock,
  getRepositoryMock,
  queueAssistantSnapshotRefreshMock,
  repositoryMock,
} = vi.hoisted(() => {
  const repository = {
    getDealAggregate: vi.fn(),
    setCurrentSummary: vi.fn(),
    saveSummary: vi.fn(),
    updateDeal: vi.fn(),
  };

  return {
    buildGeneratedSummaryVariantMock: vi.fn(),
    getRepositoryMock: vi.fn(() => repository),
    queueAssistantSnapshotRefreshMock: vi.fn(),
    repositoryMock: repository,
  };
});

vi.mock("@/lib/conflict-intelligence", () => ({
  buildConflictResultsIfEnabled: vi.fn(),
}));

vi.mock("@/lib/intake-state", () => ({
  syncIntakeSessionForDealId: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertViewerWithinUsageLimit: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  emitNotificationSeedForUser: vi.fn(),
}));

vi.mock("@/lib/repository", () => ({
  getRepository: getRepositoryMock,
}));

vi.mock("@/lib/summary-variants", () => ({
  buildGeneratedSummaryVariant: buildGeneratedSummaryVariantMock,
}));

vi.mock("@/lib/deals/shared", () => ({
  createEmptyTerms: vi.fn(),
  hydrateProfileBackedCreatorName: vi.fn(),
  mergeTerms: vi.fn(),
  queueAssistantSnapshotRefresh: queueAssistantSnapshotRefreshMock,
}));

import { createSeedStore } from "@/lib/repository/seed";
import { activateSummaryVariantForViewer } from "@/lib/deals/service";
import type { DealAggregate, SummaryRecord, Viewer } from "@/lib/types";

function createAggregate(overrides?: Partial<DealAggregate>): DealAggregate {
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
    jobs: seed.jobs,
    documentSections: seed.documentSections,
    documentRuns: seed.documentRuns,
    documentArtifacts: seed.documentArtifacts,
    documentFieldEvidence: seed.documentFieldEvidence,
    documentReviewItems: seed.documentReviewItems,
    extractionResults: seed.extractionResults,
    extractionEvidence: seed.extractionEvidence,
    summaries: seed.summaries,
    currentSummary: seed.summaries[0],
    intakeSession: null,
    ...overrides,
  };
}

describe("deal summary variants", () => {
  const viewer = {
    id: "viewer-1",
    displayName: "Creator",
    email: "creator@example.com",
    mode: "demo",
  } as const satisfies Viewer;

  beforeEach(() => {
    repositoryMock.getDealAggregate.mockReset();
    repositoryMock.setCurrentSummary.mockReset();
    repositoryMock.saveSummary.mockReset();
    repositoryMock.updateDeal.mockReset();
    buildGeneratedSummaryVariantMock.mockReset();
    queueAssistantSnapshotRefreshMock.mockReset();
    queueAssistantSnapshotRefreshMock.mockResolvedValue(undefined);
  });

  it("activates an existing saved variant when it matches the latest legal summary", async () => {
    const legalSummary: SummaryRecord = {
      id: "summary-legal",
      dealId: "demo-deal",
      documentId: "demo-document",
      body: "Legal summary",
      version: "llm:legal",
      summaryType: "legal",
      source: "analysis",
      parentSummaryId: null,
      isCurrent: true,
      createdAt: "2026-04-17T00:00:00.000Z",
    };
    const plainSummary: SummaryRecord = {
      id: "summary-plain",
      dealId: "demo-deal",
      documentId: "demo-document",
      body: "Plain summary",
      version: "llm:plain",
      summaryType: "plain_language",
      source: "simplification",
      parentSummaryId: legalSummary.id,
      isCurrent: false,
      createdAt: "2026-04-17T00:05:00.000Z",
    };
    const aggregate = createAggregate({
      summaries: [plainSummary, legalSummary],
      currentSummary: legalSummary,
    });

    repositoryMock.getDealAggregate.mockResolvedValue(aggregate);
    repositoryMock.setCurrentSummary.mockResolvedValue({
      ...plainSummary,
      isCurrent: true,
    });
    repositoryMock.updateDeal.mockResolvedValue(aggregate.deal);

    const result = await activateSummaryVariantForViewer(viewer, aggregate.deal.id, "plain_language");

    expect(repositoryMock.setCurrentSummary).toHaveBeenCalledWith(aggregate.deal.id, plainSummary.id);
    expect(buildGeneratedSummaryVariantMock).not.toHaveBeenCalled();
    expect(repositoryMock.saveSummary).not.toHaveBeenCalled();
    expect(repositoryMock.updateDeal).toHaveBeenCalledWith(viewer.id, aggregate.deal.id, {
      summary: plainSummary.body,
    });
    expect(result).toEqual({
      ...plainSummary,
      isCurrent: true,
    });
  });

  it("regenerates a variant when the saved one is stale against the latest legal summary", async () => {
    const latestLegal: SummaryRecord = {
      id: "summary-legal-new",
      dealId: "demo-deal",
      documentId: "demo-document",
      body: "New legal summary",
      version: "llm:legal",
      summaryType: "legal",
      source: "analysis",
      parentSummaryId: null,
      isCurrent: true,
      createdAt: "2026-04-17T02:00:00.000Z",
    };
    const stalePlain: SummaryRecord = {
      id: "summary-plain-old",
      dealId: "demo-deal",
      documentId: "demo-document",
      body: "Old plain summary",
      version: "llm:plain",
      summaryType: "plain_language",
      source: "simplification",
      parentSummaryId: "summary-legal-old",
      isCurrent: false,
      createdAt: "2026-04-17T01:00:00.000Z",
    };
    const aggregate = createAggregate({
      summaries: [stalePlain, latestLegal],
      currentSummary: latestLegal,
    });
    const generated = {
      body: "Fresh plain summary",
      version: "llm:plain:fresh",
      summaryType: "plain_language" as const,
      source: "simplification" as const,
      parentSummaryId: latestLegal.id,
      isCurrent: true,
    };
    const saved = {
      ...generated,
      id: "summary-plain-new",
      dealId: aggregate.deal.id,
      documentId: latestLegal.documentId,
      createdAt: "2026-04-17T02:10:00.000Z",
    };

    repositoryMock.getDealAggregate.mockResolvedValue(aggregate);
    buildGeneratedSummaryVariantMock.mockResolvedValue(generated);
    repositoryMock.saveSummary.mockResolvedValue(saved);
    repositoryMock.updateDeal.mockResolvedValue(aggregate.deal);

    const result = await activateSummaryVariantForViewer(viewer, aggregate.deal.id, "plain_language");

    expect(repositoryMock.setCurrentSummary).not.toHaveBeenCalled();
    expect(buildGeneratedSummaryVariantMock).toHaveBeenCalledWith({
      aggregate,
      baseSummary: latestLegal,
      targetType: "plain_language",
    });
    expect(repositoryMock.saveSummary).toHaveBeenCalledWith(
      aggregate.deal.id,
      latestLegal.documentId,
      generated
    );
    expect(repositoryMock.updateDeal).toHaveBeenCalledWith(viewer.id, aggregate.deal.id, {
      summary: saved.body,
    });
    expect(result).toEqual(saved);
  });
});
