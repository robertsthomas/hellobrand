import { describe, expect, test } from "vitest";

import {
  mapContractLlamaExtractResponse,
  resolveContractLlamaExtractMode
} from "@/lib/analysis/llamaextract";
import type { PendingExtractionData } from "@/lib/types";

function createFallbackTerms(): PendingExtractionData {
  return {
    brandName: "Acme",
    agencyName: null,
    creatorName: "Taylor Creator",
    campaignName: "Spring Launch",
    paymentAmount: 1200,
    currency: "USD",
    paymentTerms: "Net 45",
    paymentStructure: null,
    netTermsDays: 45,
    paymentTrigger: null,
    deliverables: [
      {
        id: "existing-deliverable",
        title: "One Reel",
        dueDate: "2026-05-01",
        channel: "Instagram",
        quantity: 1,
        status: "pending",
        description: "Existing deliverable"
      }
    ],
    usageRights: null,
    usageRightsOrganicAllowed: null,
    usageRightsPaidAllowed: false,
    whitelistingAllowed: false,
    usageDuration: null,
    usageTerritory: null,
    usageChannels: ["Instagram"],
    exclusivity: null,
    exclusivityApplies: false,
    exclusivityCategory: null,
    exclusivityDuration: null,
    exclusivityRestrictions: null,
    brandCategory: null,
    competitorCategories: [],
    restrictedCategories: [],
    campaignDateWindow: null,
    disclosureObligations: [],
    revisions: null,
    revisionRounds: 2,
    termination: null,
    terminationAllowed: null,
    terminationNotice: null,
    terminationConditions: null,
    governingLaw: null,
    notes: null,
    manuallyEditedFields: [],
    briefData: null
  };
}

describe("contract llamaextract routing", () => {
  test("uses primary mode only for file-backed contracts with a key", () => {
    expect(
      resolveContractLlamaExtractMode("contract", "file", {
        hasApiKey: true,
        requestedMode: "primary"
      })
    ).toBe("primary");

    expect(
      resolveContractLlamaExtractMode("contract", "pasted_text", {
        hasApiKey: true,
        requestedMode: "primary"
      })
    ).toBe("off");

    expect(
      resolveContractLlamaExtractMode("invoice", "file", {
        hasApiKey: true,
        requestedMode: "primary"
      })
    ).toBe("off");

    expect(
      resolveContractLlamaExtractMode("contract", "file", {
        hasApiKey: false,
        requestedMode: "shadow"
      })
    ).toBe("off");
  });
});

describe("contract llamaextract mapping", () => {
  test("maps scalar fields and citations into the existing evidence shape", () => {
    const result = mapContractLlamaExtractResponse(
      {
        extract_result: {
          paymentAmount: 2500,
          paymentTerms: "Net 30",
          usageRightsPaidAllowed: true
        },
        extract_metadata: {
          field_metadata: {
            paymentTerms: {
              confidence: 0.82,
              citation: [
                {
                  matching_text: "Brand shall pay Creator within thirty (30) days."
                }
              ]
            }
          }
        }
      },
      createFallbackTerms()
    );

    expect(result.data.paymentAmount).toBe(2500);
    expect(result.data.paymentTerms).toBe("Net 30");
    expect(result.data.usageRightsPaidAllowed).toBe(true);
    expect(result.evidence).toEqual([
      {
        fieldPath: "paymentTerms",
        snippet: "Brand shall pay Creator within thirty (30) days.",
        sectionKey: null,
        confidence: 0.82
      }
    ]);
  });

  test("maps nested arrays and objects while flattening evidence to top-level fields", () => {
    const result = mapContractLlamaExtractResponse(
      {
        extract_result: {
          deliverables: [
            {
              title: "TikTok video",
              dueDate: "2026-06-01",
              channel: "TikTok",
              quantity: 1,
              description: "One sponsored TikTok post"
            }
          ],
          campaignDateWindow: {
            startDate: "2026-05-20",
            endDate: "2026-06-01",
            postingWindow: "Post between May 20 and June 1"
          },
          disclosureObligations: [
            {
              title: "FTC disclosure",
              detail: "Include #ad in caption",
              source: "Section 4"
            }
          ]
        },
        extract_metadata: {
          field_metadata: {
            deliverables: [
              {
                title: {
                  citation: [{ matching_text: "1 TikTok video" }],
                  confidence: 0.73
                }
              }
            ],
            campaignDateWindow: {
              postingWindow: {
                citation: [{ matching_text: "Post between May 20 and June 1" }]
              }
            }
          }
        }
      },
      createFallbackTerms()
    );

    expect(result.data.deliverables).toHaveLength(1);
    expect(result.data.deliverables[0]?.title).toBe("TikTok video");
    expect(result.data.campaignDateWindow?.postingWindow).toBe(
      "Post between May 20 and June 1"
    );
    expect(result.data.disclosureObligations[0]?.detail).toBe("Include #ad in caption");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "deliverables",
          snippet: "1 TikTok video",
          sectionKey: null
        }),
        expect.objectContaining({
          fieldPath: "campaignDateWindow",
          snippet: "Post between May 20 and June 1",
          sectionKey: null
        })
      ])
    );
  });

  test("does not overwrite stable defaults with null or missing fields", () => {
    const fallback = createFallbackTerms();
    const result = mapContractLlamaExtractResponse(
      {
        extract_result: {
          paymentAmount: null,
          usageChannels: null,
          deliverables: null,
          revisionRounds: null
        },
        extract_metadata: {
          field_metadata: {}
        }
      },
      fallback
    );

    expect(result.data.paymentAmount).toBe(fallback.paymentAmount);
    expect(result.data.usageChannels).toEqual(fallback.usageChannels);
    expect(result.data.deliverables).toEqual(fallback.deliverables);
    expect(result.data.revisionRounds).toBe(fallback.revisionRounds);
    expect(result.evidence).toEqual([]);
  });
});
