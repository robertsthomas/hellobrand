import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/document-pipeline-shared", () => ({
  createEmptyTerms: (deal: { brandName: string | null; campaignName: string | null }) => ({
    brandName: deal.brandName,
    agencyName: null,
    creatorName: null,
    campaignName: deal.campaignName,
    paymentAmount: null,
    currency: null,
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
    pendingExtraction: null
  })
}));

import {
  hasMeaningfulInvoiceExtraction,
  mapDocumentAiInvoiceToExtraction
} from "@/lib/document-ai-invoice";

describe("document ai invoice mapping", () => {
  it("maps invoice entities into the current extraction shape", () => {
    const extraction = mapDocumentAiInvoiceToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: "INV-001 2026/04/09 2026/05/09 Lunchables USD 5000 Net 30",
        entities: [
          {
            type: "invoice_id",
            mentionText: "INV-001",
            confidence: 0.98
          },
          {
            type: "invoice_date",
            mentionText: "2026/04/09",
            confidence: 0.95,
            normalizedValue: {
              text: "2026-04-09",
              dateValue: {
                year: 2026,
                month: 4,
                day: 9
              }
            }
          },
          {
            type: "due_date",
            mentionText: "2026/05/09",
            confidence: 0.94,
            normalizedValue: {
              text: "2026-05-09",
              dateValue: {
                year: 2026,
                month: 5,
                day: 9
              }
            }
          },
          {
            type: "receiver_name",
            mentionText: "Lunchables",
            confidence: 0.9
          },
          {
            type: "amount_due",
            mentionText: "USD 5000",
            confidence: 0.97,
            normalizedValue: {
              text: "5000.00",
              moneyValue: {
                currencyCode: "USD",
                units: 5000,
                nanos: 0
              }
            }
          },
          {
            type: "payment_terms",
            mentionText: "Net 30",
            confidence: 0.93
          },
          {
            type: "supplier_name",
            mentionText: "Thomas Roberts LLC",
            confidence: 0.88
          }
        ]
      }
    });

    expect(extraction.model).toBe("document_ai:invoice_parser");
    expect(extraction.data.brandName).toBe("Lunchables");
    expect(extraction.data.paymentAmount).toBe(5000);
    expect(extraction.data.currency).toBe("USD");
    expect(extraction.data.paymentTerms).toBe("Net 30");
    expect(extraction.data.notes).toContain("Invoice INV-001");
    expect(extraction.data.notes).toContain("issued 2026-04-09");
    expect(extraction.data.notes).toContain("due 2026-05-09");
    expect(extraction.evidence.some((entry) => entry.fieldPath === "paymentAmount")).toBe(true);
    expect(extraction.evidence.some((entry) => entry.fieldPath === "invoice.invoiceDate")).toBe(
      true
    );
    expect(
      extraction.evidence.some((entry) => entry.fieldPath === "invoice.supplierName")
    ).toBe(true);
    expect(hasMeaningfulInvoiceExtraction(extraction)).toBe(true);
  });
});
