import { describe, expect, it } from "vitest";

import { buildInvoiceLineItems, computeInvoiceReminderAnchorDate } from "@/lib/invoices";
import type { DealAggregate, DealRecord, DealTermsRecord, DocumentRecord } from "@/lib/types";

function makeDeal(): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brandName: "Nimbus",
    campaignName: "Spring Drop",
    status: "negotiating",
    paymentStatus: "not_invoiced",
    countersignStatus: "pending",
    summary: null,
    legalDisclaimer: "Not legal advice.",
    nextDeliverableDate: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    analyzedAt: null,
    confirmedAt: "2026-03-01T00:00:00.000Z",
    statusBeforeArchive: null
  };
}

function makeTerms(): DealTermsRecord {
  return {
    id: "terms-1",
    dealId: "deal-1",
    brandName: "Nimbus",
    agencyName: null,
    creatorName: "Creator",
    campaignName: "Spring Drop",
    paymentAmount: 3000,
    currency: "USD",
    paymentTerms: "Net 30",
    paymentStructure: "Flat fee",
    netTermsDays: 30,
    paymentTrigger: "After final post",
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
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z"
  };
}

function makeAggregate(terms: DealTermsRecord): DealAggregate {
  const document: DocumentRecord = {
    id: "doc-1",
    dealId: "deal-1",
    userId: "user-1",
    fileName: "contract.pdf",
    mimeType: "application/pdf",
    storagePath: "/tmp/contract.pdf",
    processingStatus: "ready",
    rawText: null,
    normalizedText: null,
    documentKind: "contract",
    classificationConfidence: 1,
    sourceType: "file",
    errorMessage: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z"
  };

  return {
    deal: makeDeal(),
    latestDocument: document,
    documents: [document],
    terms,
    conflictResults: [],
    paymentRecord: null,
    invoiceRecord: null,
    riskFlags: [],
    emailDrafts: [],
    jobs: [],
    documentSections: [],
    extractionResults: [],
    extractionEvidence: [],
    summaries: [],
    currentSummary: null,
    intakeSession: null
  };
}

describe("buildInvoiceLineItems", () => {
  it("allocates total invoice amount across deliverable quantities", () => {
    const lineItems = buildInvoiceLineItems({
      amount: 3000,
      fallbackTitle: "Spring Drop",
      deliverables: [
        {
          id: "d1",
          title: "TikTok videos",
          dueDate: "2026-03-30",
          channel: "TikTok",
          quantity: 2,
          status: "pending",
          description: null
        },
        {
          id: "d2",
          title: "Instagram story",
          dueDate: "2026-03-31",
          channel: "Instagram",
          quantity: 1,
          status: "pending",
          description: null
        }
      ]
    });

    expect(lineItems).toHaveLength(2);
    expect(lineItems[0]).toMatchObject({
      title: "TikTok videos",
      quantity: 2,
      unitRate: 1000,
      amount: 2000
    });
    expect(lineItems[1]).toMatchObject({
      title: "Instagram story",
      quantity: 1,
      unitRate: 1000,
      amount: 1000
    });
  });

  it("falls back to a single campaign line item when no deliverables exist", () => {
    const lineItems = buildInvoiceLineItems({
      amount: 1800,
      fallbackTitle: "Spring Drop",
      deliverables: []
    });

    expect(lineItems).toEqual([
      expect.objectContaining({
        title: "Spring Drop",
        quantity: 1,
        unitRate: 1800,
        amount: 1800
      })
    ]);
  });
});

describe("computeInvoiceReminderAnchorDate", () => {
  it("uses the latest deliverable due date when available", () => {
    const terms = makeTerms();
    terms.deliverables = [
      {
        id: "d1",
        title: "Story",
        dueDate: "2026-03-28",
        channel: "Instagram",
        quantity: 1,
        status: "pending",
        description: null
      },
      {
        id: "d2",
        title: "Reel",
        dueDate: "2026-03-31",
        channel: "Instagram",
        quantity: 1,
        status: "pending",
        description: null
      }
    ];

    expect(computeInvoiceReminderAnchorDate(makeAggregate(terms))).toBe(
      "2026-03-31T04:00:00.000Z"
    );
  });

  it("falls back to the campaign end date when no deliverable dates exist", () => {
    const terms = makeTerms();
    terms.campaignDateWindow = {
      startDate: "2026-03-20T00:00:00.000Z",
      endDate: "2026-04-05T00:00:00.000Z",
      postingWindow: "Mar 20 - Apr 5"
    };

    expect(computeInvoiceReminderAnchorDate(makeAggregate(terms))).toBe(
      "2026-04-05T04:00:00.000Z"
    );
  });
});
