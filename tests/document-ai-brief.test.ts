import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hasMeaningfulBriefExtraction,
  mapDocumentAiBriefToExtraction
} from "@/lib/document-ai-brief";

describe("document ai brief mapping", () => {
  it("maps custom brief entities into briefData without touching legal terms", () => {
    const extraction = mapDocumentAiBriefToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: `
          Campaign overview Launch a back-to-school creator push.
          Messaging points:
          • Lunchables are convenient
          • Keep the tone playful
          Talking points:
          • Show product in use
          • Mention easy lunch prep
          Creative concept overview Real-life lunchbox moment.
          Brand guidelines Keep visuals bright and family-safe.
          Approval requirements Brand review required before posting.
          Target audience US parents with school-age kids.
          Tone and style Upbeat and credible.
          Do not mention:
          • Guaranteed nutrition claims
          • Negative competitor comparisons
        `,
        entities: [
          {
            type: "campaign_overview",
            mentionText: "Launch a back-to-school creator push.",
            confidence: 0.92
          },
          {
            type: "messaging_points",
            mentionText: "Lunchables are convenient\nKeep the tone playful",
            confidence: 0.88
          },
          {
            type: "talking_points",
            mentionText: "Show product in use\nMention easy lunch prep",
            confidence: 0.86
          },
          {
            type: "creative_concept_overview",
            mentionText: "Real-life lunchbox moment.",
            confidence: 0.83
          },
          {
            type: "brand_guidelines",
            mentionText: "Keep visuals bright and family-safe.",
            confidence: 0.82
          },
          {
            type: "approval_requirements",
            mentionText: "Brand review required before posting.",
            confidence: 0.9
          },
          {
            type: "target_audience",
            mentionText: "US parents with school-age kids.",
            confidence: 0.8
          },
          {
            type: "tone_and_style",
            mentionText: "Upbeat and credible.",
            confidence: 0.79
          },
          {
            type: "do_not_mention",
            mentionText: "Guaranteed nutrition claims\nNegative competitor comparisons",
            confidence: 0.84
          }
        ]
      }
    });

    expect(extraction.model).toBe("document_ai:brief_custom_extractor");
    expect(extraction.data.briefData?.campaignOverview).toBe(
      "Launch a back-to-school creator push."
    );
    expect(extraction.data.briefData?.messagingPoints).toEqual([
      "Lunchables are convenient",
      "Keep the tone playful"
    ]);
    expect(extraction.data.briefData?.talkingPoints).toEqual([
      "Show product in use",
      "Mention easy lunch prep"
    ]);
    expect(extraction.data.briefData?.doNotMention).toEqual([
      "Guaranteed nutrition claims",
      "Negative competitor comparisons"
    ]);
    expect(extraction.data.paymentAmount).toBeNull();
    expect(extraction.evidence.some((entry) => entry.fieldPath === "briefData.messagingPoints")).toBe(
      true
    );
    expect(hasMeaningfulBriefExtraction(extraction)).toBe(true);
  });

  it("marks conflicts when multiple campaign overviews exist", () => {
    const extraction = mapDocumentAiBriefToExtraction({
      deal: {
        brandName: null,
        campaignName: null
      },
      document: {
        text: "Overview A Overview B",
        entities: [
          { type: "campaign_overview", mentionText: "Overview A", confidence: 0.9 },
          { type: "campaign_overview", mentionText: "Overview B", confidence: 0.88 }
        ]
      }
    });

    expect(extraction.conflicts).toContain("briefData.campaignOverview");
  });
});
