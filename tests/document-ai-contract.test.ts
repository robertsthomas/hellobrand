import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hasMeaningfulContractExtraction,
  mapDocumentAiContractToExtraction
} from "@/lib/document-ai-contract";

describe("document ai contract mapping", () => {
  it("maps custom contract entities into the internal extraction shape", () => {
    const extraction = mapDocumentAiContractToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: `
          Lunchables creator agreement
          Campaign KHC - Lunchables Core CLP 2026
          Fee USD 5000
          Payment terms Net 30
          Usage rights organic reposting plus paid media through campaign duration + 30 days
          Paid usage allowed
          Whitelisting allowed
          Exclusivity against Lunchly for 30 days
          Deliverables 1 TikTok video
          Two rounds of revisions
          Termination with 7 days notice
          Governing law New York
        `,
        entities: [
          { type: "brand_name", mentionText: "Lunchables", confidence: 0.95 },
          {
            type: "campaign_name",
            mentionText: "KHC - Lunchables Core CLP 2026",
            confidence: 0.93
          },
          {
            type: "campaign_agency",
            mentionText: "Collectively Inc.",
            confidence: 0.9
          },
          {
            type: "creator_name",
            mentionText: "The Roberts Casa",
            confidence: 0.9
          },
          {
            type: "campaign_live_date",
            mentionText: "2026-05-15",
            confidence: 0.89
          },
          { type: "payment_amount", mentionText: "USD 5000", confidence: 0.97 },
          { type: "currency_type", mentionText: "USD", confidence: 0.91 },
          { type: "payment_terms", mentionText: "Net 30", confidence: 0.92 },
          {
            type: "usage_rights",
            mentionText: "organic reposting plus paid media",
            confidence: 0.88
          },
          {
            type: "usage_duration",
            mentionText: "through campaign duration + 30 days",
            confidence: 0.84
          },
          {
            type: "paid_usage_allowed",
            mentionText: "allowed",
            confidence: 0.9
          },
          {
            type: "whitelisting_allowed",
            mentionText: "allowed",
            confidence: 0.89
          },
          {
            type: "exclusivity_summary",
            mentionText: "Exclusivity against Lunchly",
            confidence: 0.83
          },
          {
            type: "exclusivity_category",
            mentionText: "Lunchly",
            confidence: 0.81
          },
          {
            type: "exclusivity_duration",
            mentionText: "30 days",
            confidence: 0.8
          },
          {
            type: "deliverables_summary",
            mentionText: "1 TikTok video",
            confidence: 0.86
          },
          {
            type: "revision_rounds",
            mentionText: "2",
            normalizedValue: { integerValue: 2 },
            confidence: 0.77
          },
          {
            type: "termination_summary",
            mentionText: "Termination with 7 days notice",
            confidence: 0.85
          },
          {
            type: "termination_notice",
            mentionText: "7 days",
            confidence: 0.82
          },
          {
            type: "governing_law",
            mentionText: "New York",
            confidence: 0.9
          },
          {
            type: "legal_clauses",
            mentionText: "Confidentiality applies to campaign materials.",
            confidence: 0.88
          }
        ]
      }
    });

    expect(extraction.model).toBe("document_ai:contract_custom_extractor");
    expect(extraction.data.brandName).toBe("Lunchables");
    expect(extraction.data.agencyName).toBe("Collectively Inc.");
    expect(extraction.data.creatorName).toBe("The Roberts Casa");
    expect(extraction.data.campaignName).toBe("KHC - Lunchables Core CLP 2026");
    expect(extraction.data.campaignDateWindow?.startDate).toBe("2026-05-15");
    expect(extraction.data.paymentAmount).toBe(5000);
    expect(extraction.data.currency).toBe("USD");
    expect(extraction.data.paymentTerms).toBe("Net 30");
    expect(extraction.data.usageRightsPaidAllowed).toBe(true);
    expect(extraction.data.whitelistingAllowed).toBe(true);
    expect(extraction.data.exclusivity).toContain("Lunchly");
    expect(extraction.data.deliverables[0]?.title).toBe("TikTok Video");
    expect(extraction.data.revisionRounds).toBe(2);
    expect(extraction.data.terminationNotice).toBe("7 days");
    expect(extraction.data.governingLaw).toBe("New York");
    expect(extraction.data.notes).toContain("Confidentiality applies");
    expect(extraction.evidence.some((entry) => entry.fieldPath === "paymentAmount")).toBe(true);
    expect(hasMeaningfulContractExtraction(extraction)).toBe(true);
  });

  it("marks conflicts when multiple values exist for a core field", () => {
    const extraction = mapDocumentAiContractToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: "Brand A Brand B",
        entities: [
          { type: "brand_name", mentionText: "Brand A", confidence: 0.9 },
          { type: "brand_name", mentionText: "Brand B", confidence: 0.88 }
        ]
      }
    });

    expect(extraction.conflicts).toContain("brandName");
  });

  it("combines repeated clause-like entities and preserves each evidence snippet", () => {
    const extraction = mapDocumentAiContractToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: "Usage one Usage two Termination one Termination two",
        entities: [
          {
            type: "usage_rights",
            mentionText: "Organic usage on brand social channels",
            textAnchor: { textSegments: [{ startIndex: 0, endIndex: 9 }] },
            confidence: 0.8
          },
          {
            type: "usage_rights",
            mentionText: "Paid amplification for 30 days",
            textAnchor: { textSegments: [{ startIndex: 10, endIndex: 19 }] },
            confidence: 0.9
          },
          {
            type: "termination_summary",
            mentionText: "Brand may terminate for creator breach",
            textAnchor: { textSegments: [{ startIndex: 20, endIndex: 35 }] },
            confidence: 0.82
          },
          {
            type: "termination_summary",
            mentionText: "Creator may terminate for non-payment",
            textAnchor: { textSegments: [{ startIndex: 36, endIndex: 51 }] },
            confidence: 0.78
          },
          {
            type: "deliverables_summary",
            mentionText: "1 TikTok video",
            confidence: 0.85
          },
          {
            type: "deliverables_summary",
            mentionText: "2 Instagram stories",
            confidence: 0.84
          }
        ]
      }
    });

    expect(extraction.data.usageRights).toContain(
      "1. Organic usage on brand social channels"
    );
    expect(extraction.data.usageRights).toContain("2. Paid amplification for 30 days");
    expect(extraction.data.termination).toContain("1. Brand may terminate for creator breach");
    expect(extraction.data.termination).toContain("2. Creator may terminate for non-payment");
    expect(extraction.data.deliverables.map((deliverable) => deliverable.title)).toEqual([
      "TikTok Video",
      "Instagram Stories"
    ]);
    expect(extraction.evidence.filter((entry) => entry.fieldPath === "usageRights")).toHaveLength(
      2
    );
    expect(extraction.evidence.filter((entry) => entry.fieldPath === "termination")).toHaveLength(
      2
    );
    expect(extraction.conflicts).not.toContain("usageRights");
    expect(extraction.conflicts).not.toContain("exclusivity");
  });
});
