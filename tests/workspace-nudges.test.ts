import { describe, expect, test } from "vitest";

import { buildWorkspaceNudgeSeed } from "@/lib/notifications";
import { computeWorkspaceNudgeSeeds } from "@/lib/notification-service";
import { createSeedStore } from "@/lib/repository/seed";
import type { DealAggregate } from "@/lib/types";

function createAggregate(overrides?: {
  status?: string;
  confirmedAt?: string | null;
  paymentAmount?: number | null;
  deliverables?: unknown[];
  usageRights?: string | null;
}): DealAggregate {
  const seed = createSeedStore();
  const deal = {
    ...seed.deals[0],
    status: (overrides?.status as DealAggregate["deal"]["status"]) ?? "negotiating",
    confirmedAt: overrides?.confirmedAt !== undefined ? overrides.confirmedAt : new Date().toISOString()
  };
  const terms = {
    ...seed.dealTerms[0],
    paymentAmount: overrides?.paymentAmount !== undefined ? overrides.paymentAmount : seed.dealTerms[0].paymentAmount,
    deliverables: overrides?.deliverables !== undefined ? overrides.deliverables as never : seed.dealTerms[0].deliverables,
    usageRights: overrides?.usageRights !== undefined ? overrides.usageRights : seed.dealTerms[0].usageRights
  };

  return {
    deal,
    latestDocument: seed.documents[0],
    documents: seed.documents,
    terms,
    conflictResults: [],
    paymentRecord: null,
    invoiceRecord: null,
    riskFlags: [],
    emailDrafts: [],
    jobs: [],
    documentSections: [],
    documentRuns: [],
    documentArtifacts: [],
    documentFieldEvidence: [],
    documentReviewItems: [],
    extractionResults: [],
    extractionEvidence: [],
    summaries: [],
    currentSummary: null,
    intakeSession: null
  };
}

describe("buildWorkspaceNudgeSeed", () => {
  test("builds a missing payment seed", () => {
    const seed = buildWorkspaceNudgeSeed({
      dealId: "deal-1",
      campaignName: "Spring Drop",
      eventType: "workspace.missing_payment"
    });

    expect(seed.eventType).toBe("workspace.missing_payment");
    expect(seed.category).toBe("workspace");
    expect(seed.dedupeKey).toBe("workspace.missing_payment:deal-1");
    expect(seed.href).toBe("/app/p/deal-1?tab=terms");
    expect(seed.title).toContain("Payment amount missing");
    expect(seed.title).toContain("Spring Drop");
  });

  test("builds a missing deliverables seed", () => {
    const seed = buildWorkspaceNudgeSeed({
      dealId: "deal-2",
      campaignName: "Summer Campaign",
      eventType: "workspace.missing_deliverables"
    });

    expect(seed.eventType).toBe("workspace.missing_deliverables");
    expect(seed.dedupeKey).toBe("workspace.missing_deliverables:deal-2");
    expect(seed.title).toContain("No deliverables found");
  });

  test("builds a missing usage rights seed", () => {
    const seed = buildWorkspaceNudgeSeed({
      dealId: "deal-3",
      campaignName: "Fall Promo",
      eventType: "workspace.missing_usage_rights"
    });

    expect(seed.eventType).toBe("workspace.missing_usage_rights");
    expect(seed.dedupeKey).toBe("workspace.missing_usage_rights:deal-3");
    expect(seed.title).toContain("Usage rights not specified");
  });
});

describe("computeWorkspaceNudgeSeeds", () => {
  test("returns no seeds when all fields are populated", () => {
    const aggregate = createAggregate({
      paymentAmount: 2000,
      deliverables: [{ id: "d1", title: "Reel", dueDate: null, channel: null, quantity: 1 }],
      usageRights: "Organic only"
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(0);
  });

  test("returns missing payment seed when paymentAmount is null", () => {
    const aggregate = createAggregate({
      paymentAmount: null,
      deliverables: [{ id: "d1", title: "Reel", dueDate: null, channel: null, quantity: 1 }],
      usageRights: "Organic only"
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].eventType).toBe("workspace.missing_payment");
  });

  test("returns missing deliverables seed when deliverables is empty", () => {
    const aggregate = createAggregate({
      paymentAmount: 2000,
      deliverables: [],
      usageRights: "Organic only"
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].eventType).toBe("workspace.missing_deliverables");
  });

  test("returns missing usage rights seed when usageRights is null", () => {
    const aggregate = createAggregate({
      paymentAmount: 2000,
      deliverables: [{ id: "d1", title: "Reel", dueDate: null, channel: null, quantity: 1 }],
      usageRights: null
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].eventType).toBe("workspace.missing_usage_rights");
  });

  test("returns multiple seeds when multiple fields are missing", () => {
    const aggregate = createAggregate({
      paymentAmount: null,
      deliverables: [],
      usageRights: null
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(3);

    const eventTypes = seeds.map((s) => s.eventType);
    expect(eventTypes).toContain("workspace.missing_payment");
    expect(eventTypes).toContain("workspace.missing_deliverables");
    expect(eventTypes).toContain("workspace.missing_usage_rights");
  });

  test("skips archived deals", () => {
    const aggregate = createAggregate({
      status: "archived",
      paymentAmount: null
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(0);
  });

  test("skips completed deals", () => {
    const aggregate = createAggregate({
      status: "completed",
      paymentAmount: null
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(0);
  });

  test("skips paid deals", () => {
    const aggregate = createAggregate({
      status: "paid",
      paymentAmount: null
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(0);
  });

  test("skips unconfirmed deals", () => {
    const aggregate = createAggregate({
      confirmedAt: null,
      paymentAmount: null
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    expect(seeds).toHaveLength(0);
  });

  test("each seed has a unique dedupeKey per deal", () => {
    const aggregate = createAggregate({
      paymentAmount: null,
      deliverables: [],
      usageRights: null
    });

    const seeds = computeWorkspaceNudgeSeeds([aggregate]);
    const dedupeKeys = seeds.map((s) => s.dedupeKey);
    expect(new Set(dedupeKeys).size).toBe(dedupeKeys.length);
  });

  test("seeds link to the terms tab", () => {
    const aggregate = createAggregate({ paymentAmount: null });
    const seeds = computeWorkspaceNudgeSeeds([aggregate]);

    for (const seed of seeds) {
      expect(seed.href).toContain("?tab=terms");
    }
  });
});
