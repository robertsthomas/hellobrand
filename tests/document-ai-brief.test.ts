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
          { type: "brand_name", mentionText: "Lunchables", confidence: 0.91 },
          {
            type: "campaign_name",
            mentionText: "Back to School Lunchbox",
            confidence: 0.9
          },
          {
            type: "product_name",
            mentionText: "Lunchables Dunkables",
            confidence: 0.89
          },
          {
            type: "campaign_objective",
            mentionText: "Drive awareness for back-to-school lunches.",
            confidence: 0.88
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
            type: "required_elements",
            mentionText: "Show product in lunchbox\nInclude #ad",
            confidence: 0.87
          },
          {
            type: "deliverables_summary",
            mentionText: "1 TikTok video and 2 Instagram stories",
            confidence: 0.86
          },
          {
            type: "deliverable_platforms",
            mentionText: "TikTok\nInstagram",
            confidence: 0.85
          },
          {
            type: "content_due_date",
            mentionText: "2026-05-01",
            confidence: 0.84
          },
          {
            type: "brand_contact_name",
            mentionText: "Jordan Ellis",
            confidence: 0.87
          },
          {
            type: "brand_contact_title",
            mentionText: "Partnerships Manager",
            confidence: 0.86
          },
          {
            type: "brand_contact_email",
            mentionText: "jordan@lunchables.com",
            confidence: 0.86
          },
          {
            type: "usage_notes",
            mentionText: "Organic reposting on brand social channels.",
            confidence: 0.83
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
    expect(extraction.data.brandName).toBe("Lunchables");
    expect(extraction.data.campaignName).toBe("Back to School Lunchbox");
    expect(extraction.data.deliverables.map((deliverable) => deliverable.title)).toEqual([
      "TikTok Video",
      "Instagram Stories"
    ]);
    expect(extraction.data.deliverables[0]?.dueDate).toBe("2026-05-01");
    expect(extraction.data.usageRights).toBe("Organic reposting on brand social channels.");
    expect(extraction.data.briefData?.campaignOverview).toBe(
      "Launch a back-to-school creator push."
    );
    expect(extraction.data.briefData?.campaignObjective).toBe(
      "Drive awareness for back-to-school lunches."
    );
    expect(extraction.data.briefData?.productName).toBe("Lunchables Dunkables");
    expect(extraction.data.briefData?.messagingPoints).toEqual([
      "Lunchables are convenient",
      "Keep the tone playful"
    ]);
    expect(extraction.data.briefData?.talkingPoints).toEqual([
      "Show product in use",
      "Mention easy lunch prep"
    ]);
    expect(extraction.data.briefData?.requiredElements).toEqual([
      "Show product in lunchbox",
      "Include #ad"
    ]);
    expect(extraction.data.briefData?.deliverablePlatforms).toEqual([
      "TikTok",
      "Instagram"
    ]);
    expect(extraction.data.briefData?.brandContactName).toBe("Jordan Ellis");
    expect(extraction.data.briefData?.brandContactTitle).toBe("Partnerships Manager");
    expect(extraction.data.briefData?.brandContactEmail).toBe("jordan@lunchables.com");
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
