import { afterEach, describe, expect, test, vi } from "vitest";

const {
  extractSectionWithLlmMock,
  extractBriefWithLlmMock,
  hasLlmKeyMock,
} = vi.hoisted(() => ({
  extractSectionWithLlmMock: vi.fn(),
  extractBriefWithLlmMock: vi.fn(),
  hasLlmKeyMock: vi.fn(),
}));

vi.mock("@/lib/analysis/llm", () => ({
  extractSectionWithLlm: extractSectionWithLlmMock,
  extractBriefWithLlm: extractBriefWithLlmMock,
  hasLlmKey: hasLlmKeyMock,
}));

import { buildStructuredExtractionForDocument } from "@/lib/pipeline/steps/extract-fields";

afterEach(() => {
  extractSectionWithLlmMock.mockReset();
  extractBriefWithLlmMock.mockReset();
  hasLlmKeyMock.mockReset();
});

describe("buildStructuredExtractionForDocument", () => {
  test("layers LLM extraction over the extracted document text for contract fields", async () => {
    hasLlmKeyMock.mockReturnValue(true);
    extractBriefWithLlmMock.mockResolvedValue(null);
    extractSectionWithLlmMock.mockImplementation(async (section, _kind, fallback) => ({
      ...fallback,
      model: "llm:test-extract",
      confidence: 0.91,
      data: {
        ...fallback.data,
        brandName: "Northstar Skin",
        campaignName: "Spring Glow",
        paymentTerms: "Net 15",
        paymentAmount: 1500,
      },
      evidence: [
        ...fallback.evidence,
        {
          fieldPath: "paymentTerms",
          snippet: `Evidence from ${section.title}: Net 15`,
          sectionKey: `section:${section.chunkIndex}`,
          confidence: 0.93,
        },
      ],
    }));

    const result = await buildStructuredExtractionForDocument({
      documentId: "doc-contract-1",
      fileName: "northstar-contract.pdf",
      normalizedText:
        "Creator Partnership Agreement\nBrand: Northstar Skin\nCampaign: Spring Glow\nPayment terms: Net 15.",
      documentKind: "contract",
      sectionInputs: [
        {
          title: "Payment Terms",
          content: "Brand: Northstar Skin\nCampaign: Spring Glow\nPayment terms: Net 15.",
          chunkIndex: 0,
          pageRange: "1",
        },
      ],
      preferredCreatorName: "Roberts Casa",
    });

    expect(extractSectionWithLlmMock).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("llm:test-extract");
    expect(result.data.creatorName).toBe("Roberts Casa");
    expect(result.data.paymentTerms).toBe("Net 15");
    expect(result.data.paymentAmount).toBe(1500);
    expect(result.evidence.some((entry) => entry.fieldPath === "paymentTerms")).toBe(true);
  });

  test("preserves LLM brief structuring and keeps source document ids for intake use", async () => {
    hasLlmKeyMock.mockReturnValue(true);
    extractSectionWithLlmMock.mockImplementation(async (_section, _kind, fallback) => ({
      ...fallback,
      model: "llm:test-extract",
      confidence: 0.88,
    }));
    extractBriefWithLlmMock.mockResolvedValue({
      campaignOverview: "Launch the new glow serum.",
      messagingPoints: ["Hydration-first"],
      talkingPoints: ["Morning routine"],
      creativeConceptOverview: "Show an everyday vanity setup.",
      brandGuidelines: "Keep the bottle label visible.",
      approvalRequirements: "Draft due 48 hours before posting.",
      targetAudience: "Busy moms",
      toneAndStyle: "Warm and confident",
      doNotMention: ["Medical claims"],
      sourceDocumentIds: [],
    });

    const result = await buildStructuredExtractionForDocument({
      documentId: "doc-brief-1",
      fileName: "glow-serum-brief.docx",
      normalizedText:
        "Glow Serum Campaign Brief\nBrand: Glow Co\nObjective: launch the new glow serum.\nAvoid medical claims.",
      documentKind: "campaign_brief",
      sectionInputs: [
        {
          title: "Overview",
          content:
            "Glow Serum Campaign Brief\nBrand: Glow Co\nObjective: launch the new glow serum.\nAvoid medical claims.",
          chunkIndex: 0,
          pageRange: "1",
        },
      ],
      preferredCreatorName: "Roberts Casa",
    });

    expect(extractBriefWithLlmMock).toHaveBeenCalledTimes(1);
    expect(result.data.briefData?.campaignOverview).toBe("Launch the new glow serum.");
    expect(result.data.briefData?.brandGuidelines).toBe("Keep the bottle label visible.");
    expect(result.data.briefData?.sourceDocumentIds).toEqual(["doc-brief-1"]);
  });
});
