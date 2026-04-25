import { describe, expect, test } from "vitest";

import { buildAnalyticsSnapshot } from "@/lib/analytics/service";
import type { DealAggregate } from "@/lib/types";

function createAggregate(
  id: string,
  overrides: Omit<Partial<DealAggregate>, "deal" | "terms" | "paymentRecord" | "invoiceRecord"> & {
    deal?: Partial<DealAggregate["deal"]>;
    terms?: Partial<NonNullable<DealAggregate["terms"]>> | null;
    paymentRecord?: Partial<NonNullable<DealAggregate["paymentRecord"]>> | null;
    invoiceRecord?: Partial<NonNullable<NonNullable<DealAggregate["invoiceRecord"]>>> | null;
  } = {}
): DealAggregate {
  return {
    deal: {
      id,
      userId: "user-1",
      brandName: `${id}-brand`,
      campaignName: `${id}-campaign`,
      status: "signed",
      paymentStatus: "not_invoiced",
      countersignStatus: "pending",
      summary: null,
      legalDisclaimer: "",
      nextDeliverableDate: null,
      analyzedAt: null,
      confirmedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      statusBeforeArchive: null,
      ...overrides.deal,
    },
    latestDocument: null,
    documents: [],
    terms:
      overrides.terms === null
        ? null
        : {
            id: `${id}-terms`,
            dealId: id,
            brandName: `${id}-brand`,
            agencyName: null,
            creatorName: null,
            campaignName: `${id}-campaign`,
            paymentAmount: 0,
            currency: "USD",
            paymentTerms: null,
            paymentStructure: null,
            netTermsDays: null,
            paymentTrigger: null,
            deliverables: [],
            usageRights: null,
            usageRightsOrganicAllowed: null,
            usageRightsPaidAllowed: null,
            whitelistingAllowed: null,
            usageDuration: null,
            usageTerritory: null,
            usageChannels: [],
            exclusivity: null,
            exclusivityApplies: null,
            exclusivityCategory: null,
            exclusivityDuration: null,
            exclusivityRestrictions: null,
            brandCategory: null,
            competitorCategories: [],
            restrictedCategories: [],
            campaignDateWindow: null,
            disclosureObligations: [],
            revisions: null,
            revisionRounds: null,
            termination: null,
            terminationAllowed: null,
            terminationNotice: null,
            terminationConditions: null,
            governingLaw: null,
            notes: null,
            manuallyEditedFields: [],
            briefData: null,
            pendingExtraction: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            ...overrides.terms,
          },
    riskFlags: [],
    conflictResults: [],
    paymentRecord:
      overrides.paymentRecord === null
        ? null
        : {
            id: `${id}-payment`,
            dealId: id,
            amount: overrides.terms?.paymentAmount ?? 0,
            currency: "USD",
            invoiceDate: null,
            dueDate: null,
            paidDate: null,
            status: "not_invoiced",
            notes: null,
            source: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            ...overrides.paymentRecord,
          },
    invoiceRecord:
      overrides.invoiceRecord === null
        ? null
        : overrides.invoiceRecord
          ? {
              id: `${id}-invoice`,
              dealId: id,
              userId: "user-1",
              invoiceNumber: `INV-${id}`,
              status: "sent",
              draftSavedAt: null,
              finalizedAt: null,
              sentAt: null,
              invoiceDate: null,
              dueDate: null,
              currency: "USD",
              subtotal: overrides.terms?.paymentAmount ?? 0,
              notes: null,
              billTo: {
                name: "Brand",
                email: null,
                companyName: null,
                address: null,
                taxId: null,
                payoutDetails: null,
              },
              issuer: {
                name: "Creator",
                email: null,
                companyName: null,
                address: null,
                taxId: null,
                payoutDetails: null,
              },
              lineItems: [],
              pdfDocumentId: null,
              manualNumberOverride: false,
              lastSentThreadId: null,
              lastSentMessageId: null,
              lastSentAccountId: null,
              lastSentToEmail: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              ...overrides.invoiceRecord,
            }
          : null,
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
    intakeSession: null,
  };
}

describe("analytics service", () => {
  test("builds stable metrics, payment health, and ranking from deal aggregates", () => {
    const snapshot = buildAnalyticsSnapshot(
      [
        createAggregate("deal-1", {
          deal: {
            brandName: "Acme",
            status: "signed",
            paymentStatus: "awaiting_payment",
            createdAt: "2026-02-01T00:00:00.000Z",
            updatedAt: "2026-04-10T00:00:00.000Z",
            confirmedAt: "2026-02-10T00:00:00.000Z",
          },
          terms: { paymentAmount: 3000 },
          paymentRecord: {
            amount: 3000,
            status: "awaiting_payment",
            invoiceDate: "2026-03-01T00:00:00.000Z",
          },
        }),
        createAggregate("deal-2", {
          deal: {
            brandName: "Bravo",
            status: "completed",
            paymentStatus: "paid",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-04-12T00:00:00.000Z",
            confirmedAt: "2026-01-05T00:00:00.000Z",
          },
          terms: { paymentAmount: 5000 },
          paymentRecord: {
            amount: 5000,
            status: "paid",
            invoiceDate: "2026-02-01T00:00:00.000Z",
            paidDate: "2026-02-15T00:00:00.000Z",
          },
        }),
        createAggregate("deal-3", {
          deal: {
            brandName: "Acme",
            status: "negotiating",
            paymentStatus: "not_invoiced",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-14T00:00:00.000Z",
          },
          terms: { paymentAmount: 2000 },
          paymentRecord: {
            amount: 2000,
            status: "not_invoiced",
          },
        }),
      ],
      null,
      { now: new Date("2026-04-20T00:00:00.000Z") }
    );

    expect(snapshot.metrics).toEqual([
      expect.objectContaining({
        label: "Tracked revenue",
        value: "$10,000",
        context: "3 total workspaces",
      }),
      expect.objectContaining({
        label: "Active partnerships",
        value: "2",
        context: "1 under review",
      }),
      expect.objectContaining({
        label: "Average partnership value",
        value: "$3,333",
        context: "7 days avg. to confirm",
      }),
      expect.objectContaining({
        label: "Awaiting payment",
        value: "1",
        context: "14 days avg. to payment",
      }),
    ]);
    expect(snapshot.paymentHealth).toEqual({
      averagePaymentDays: 14,
      averageConfirmationDays: 7,
      overdueCount: 0,
      paidCount: 1,
      awaitingCount: 1,
    });
    expect(snapshot.formattedTopContent.map((item) => item.brandName)).toEqual([
      "Bravo",
      "Acme",
      "Acme",
    ]);
    expect(snapshot.pipelineBreakdown.find((item) => item.key === "completed")).toMatchObject({
      count: 1,
      revenue: 5000,
    });
  });

  test("supports brand and raw-status filtering before analytics are shaped", () => {
    const snapshot = buildAnalyticsSnapshot(
      [
        createAggregate("deal-1", {
          deal: { brandName: "Acme", status: "signed", updatedAt: "2026-04-10T00:00:00.000Z" },
          terms: { paymentAmount: 3000 },
        }),
        createAggregate("deal-2", {
          deal: {
            brandName: "Bravo",
            status: "negotiating",
            updatedAt: "2026-04-10T00:00:00.000Z",
          },
          terms: { paymentAmount: 4000 },
        }),
      ],
      null,
      {
        brandNames: ["Acme"],
        statuses: ["signed"],
        now: new Date("2026-04-20T00:00:00.000Z"),
      }
    );

    expect(snapshot.totalDeals).toBe(1);
    expect(snapshot.availableBrands).toEqual(["Acme", "Bravo"]);
    expect(snapshot.availableStatuses).toEqual(["negotiating", "signed"]);
    expect(snapshot.metrics[0]).toMatchObject({
      label: "Tracked revenue",
      value: "$3,000",
    });
  });

  test("applies the requested activity window to the snapshot", () => {
    const snapshot = buildAnalyticsSnapshot(
      [
        createAggregate("deal-1", {
          deal: { brandName: "Recent", updatedAt: "2026-04-18T00:00:00.000Z" },
          terms: { paymentAmount: 1000 },
        }),
        createAggregate("deal-2", {
          deal: { brandName: "Old", updatedAt: "2025-12-01T00:00:00.000Z" },
          terms: { paymentAmount: 9000 },
        }),
      ],
      null,
      {
        range: "30d",
        now: new Date("2026-04-20T00:00:00.000Z"),
      }
    );

    expect(snapshot.totalDeals).toBe(1);
    expect(snapshot.metrics[0]).toMatchObject({
      label: "Tracked revenue",
      value: "$1,000",
    });
    expect(snapshot.monthlyRevenue).toHaveLength(2);
  });

  test("excludes archived workspaces from metrics unless explicitly included", () => {
    const aggregates = [
      createAggregate("deal-1", {
        deal: {
          brandName: "Active Brand",
          status: "signed",
          updatedAt: "2026-04-18T00:00:00.000Z",
        },
        terms: { paymentAmount: 2500 },
      }),
      createAggregate("deal-2", {
        deal: {
          brandName: "Archived Brand",
          status: "archived",
          updatedAt: "2026-04-18T00:00:00.000Z",
        },
        terms: { paymentAmount: 7500 },
      }),
    ];

    const defaultSnapshot = buildAnalyticsSnapshot(aggregates, null, {
      now: new Date("2026-04-20T00:00:00.000Z"),
    });
    const includedSnapshot = buildAnalyticsSnapshot(aggregates, null, {
      includeArchived: true,
      now: new Date("2026-04-20T00:00:00.000Z"),
    });

    expect(defaultSnapshot.totalDeals).toBe(1);
    expect(defaultSnapshot.metrics[0]).toMatchObject({
      label: "Tracked revenue",
      value: "$2,500",
    });
    expect(includedSnapshot.totalDeals).toBe(2);
    expect(
      includedSnapshot.pipelineBreakdown.find((entry) => entry.key === "archived")
    ).toMatchObject({
      count: 1,
      revenue: 7500,
    });
  });
});
