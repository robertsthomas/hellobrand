import { describe, expect, test } from "vitest";

import { fallbackAnalyzeDocument } from "@/lib/analysis/fallback";

const AMAZON_KIDS_BRIEF = `
Amazon Kids Influencer Brief
Stories with Alexa
Overview: We’re partnering with creators like you to highlight the exciting features of Alexa+ on kids Echo devices.

Key Messaging:
- Echo and Alexa+ grows with your children, offering age appropriate content as they grow up.
- Stories with Alexa allows your kids to embrace their creativity and decide what happens next.

Creative Requirements:
- Show your child interacting with Stories with Alexa.
- Speak to key messaging points.
- Lead with a branded hook in the first 3 seconds.

Content Concept
Please share your content concept in the below format:
[Influencer Name] - Campaign Concept
- IG Reel or TikTok: 3-4 sentences on what key messages you will highlight and feature in your content.
- IG Story: 3-4 sentences on what key messages you will highlight and feature in your content.

Required Elements:
- Hashtag: #amazonkids #ad
- Instagram Handle: @amazon @amazonkids
`;

describe("brief fallback analysis", () => {
  test("infers brand, campaign title, deliverables, and summary for creator briefs", () => {
    const result = fallbackAnalyzeDocument(AMAZON_KIDS_BRIEF, {
      fileName: "Amazon Kids Influencer Brief_ Stories with Alexa.docx"
    });

    expect(result.classification.documentKind).toBe("campaign_brief");
    expect(result.extraction.data.brandName).toBe("Amazon Kids");
    expect(result.extraction.data.campaignName).toBe("Stories with Alexa");
    expect(result.extraction.data.deliverables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "IG Reel or TikTok" }),
        expect.objectContaining({ title: "IG Story" })
      ])
    );
    expect(result.summary.body).toContain("Amazon Kids");
    expect(result.summary.body).toContain("Stories with Alexa");
    expect(result.summary.body).toContain("Key messaging includes");
  });

  test("skips generic brief headings and uses the first real brand line", () => {
    const result = fallbackAnalyzeDocument(
      `
Campaign Brief
NimbusPM
Summer Push
Overview: Create content for the NimbusPM summer push.
`,
      {
        fileName: "campaign_brief_nimbuspm.pdf"
      }
    );

    expect(result.extraction.data.brandName).toBe("NimbusPM");
    expect(result.extraction.data.campaignName).toBe("Summer Push");
  });

  test("does not treat usage-rights headings as brand or campaign names", () => {
    const result = fallbackAnalyzeDocument(
      `
Brand Usage Rights
Campaign Overview
NimbusPM
Summer Push
Overview: Create content for the NimbusPM summer push.
`,
      {
        fileName: "nimbuspm_brief.pdf"
      }
    );

    expect(result.extraction.data.brandName).toBe("NimbusPM");
    expect(result.extraction.data.campaignName).toBe("Summer Push");
  });
});
