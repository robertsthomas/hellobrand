import { beforeEach, describe, expect, it, vi } from "vitest";

const llmMocks = vi.hoisted(() => ({
  consolidateClausesWithLlm: vi.fn(),
  hasLlmKey: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/analysis/llm", () => llmMocks);

import {
  consolidateContractClausesWithLlm,
  mapDocumentAiContractToExtraction
} from "@/lib/document-ai-contract";

describe("document ai contract clause consolidation", () => {
  beforeEach(() => {
    llmMocks.consolidateClausesWithLlm.mockReset();
    llmMocks.hasLlmKey.mockReset();
  });

  it("uses OpenRouter only to summarize repeated Document AI clause occurrences", async () => {
    llmMocks.hasLlmKey.mockReturnValue(true);
    llmMocks.consolidateClausesWithLlm.mockResolvedValue({
      usageRights: "Brand may use organic content for 30 days and paid media requires approval.",
      exclusivity: "Creator cannot work with named competitors during the campaign.",
      deliverablesSummary: "Creator must provide 1 TikTok video and 2 Instagram stories.",
      termination: "Brand can terminate for breach and creator can terminate for non-payment.",
      notes: "Approval timing should be confirmed.",
      model: "test-model"
    });

    const extraction = mapDocumentAiContractToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: "Usage one Usage two Exclusivity one Exclusivity two Term one Term two",
        entities: [
          {
            type: "usage_rights",
            mentionText: "Brand may use organic content for 30 days.",
            confidence: 0.88
          },
          {
            type: "usage_rights",
            mentionText: "Paid media requires creator approval.",
            confidence: 0.87
          },
          {
            type: "exclusivity_summary",
            mentionText: "No competitor posts during the campaign.",
            confidence: 0.86
          },
          {
            type: "exclusivity_summary",
            mentionText: "Competitors include named lunch kit brands.",
            confidence: 0.85
          },
          {
            type: "deliverables_summary",
            mentionText: "1 TikTok video",
            confidence: 0.84
          },
          {
            type: "deliverables_summary",
            mentionText: "2 Instagram stories",
            confidence: 0.83
          },
          {
            type: "termination_summary",
            mentionText: "Brand may terminate for creator breach.",
            confidence: 0.82
          },
          {
            type: "termination_summary",
            mentionText: "Creator may terminate for non-payment.",
            confidence: 0.81
          },
          {
            type: "notes",
            mentionText: "Approval timing is not stated.",
            confidence: 0.8
          },
          {
            type: "notes",
            mentionText: "Shipping timing is not stated.",
            confidence: 0.79
          }
        ]
      }
    });

    const consolidated = await consolidateContractClausesWithLlm(extraction);

    expect(llmMocks.consolidateClausesWithLlm).toHaveBeenCalledWith(
      expect.objectContaining({
        usageRights: [
          "Brand may use organic content for 30 days.",
          "Paid media requires creator approval."
        ],
        deliverables: ["1 TikTok video", "2 Instagram stories"],
        notes: ["Approval timing is not stated.", "Shipping timing is not stated."]
      })
    );
    expect(consolidated.model).toBe(
      "document_ai:contract_custom_extractor+llm:test-model"
    );
    expect(consolidated.data.usageRights).toBe(
      "Brand may use organic content for 30 days and paid media requires approval."
    );
    expect(consolidated.data.exclusivity).toBe(
      "Creator cannot work with named competitors during the campaign."
    );
    expect(consolidated.data.termination).toBe(
      "Brand can terminate for breach and creator can terminate for non-payment."
    );
    expect(consolidated.data.deliverables.map((deliverable) => deliverable.title)).toEqual([
      "TikTok Video",
      "Instagram Stories"
    ]);
    expect(consolidated.data.notes).toContain("Approval timing should be confirmed.");
    expect(consolidated.data.notes).toContain(
      "Deliverables: Creator must provide 1 TikTok video and 2 Instagram stories."
    );
  });

  it("does not call OpenRouter when repeated clause evidence is absent", async () => {
    llmMocks.hasLlmKey.mockReturnValue(true);
    const extraction = mapDocumentAiContractToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: "Usage",
        entities: [
          {
            type: "usage_rights",
            mentionText: "Brand may use organic content for 30 days.",
            confidence: 0.88
          }
        ]
      }
    });

    await expect(consolidateContractClausesWithLlm(extraction)).resolves.toBe(extraction);
    expect(llmMocks.consolidateClausesWithLlm).not.toHaveBeenCalled();
  });
});
