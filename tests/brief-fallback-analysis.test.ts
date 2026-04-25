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
      fileName: "Amazon Kids Influencer Brief_ Stories with Alexa.docx",
    });

    expect(result.classification.documentKind).toBe("campaign_brief");
    expect(result.extraction.data.brandName).toBe("Amazon Kids");
    expect(result.extraction.data.campaignName).toBe("Stories with Alexa");
    expect(result.extraction.data.deliverables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "IG Reel or TikTok" }),
        expect.objectContaining({ title: "IG Story" }),
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
        fileName: "campaign_brief_nimbuspm.pdf",
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
        fileName: "nimbuspm_brief.pdf",
      }
    );

    expect(result.extraction.data.brandName).toBe("NimbusPM");
    expect(result.extraction.data.campaignName).toBe("Summer Push");
  });

  test("extracts richer creator-brief workflow fields from a deliverables brief", () => {
    const result = fallbackAnalyzeDocument(
      `
Deliverables Brief
Acme Beauty
Summer Skin Reset

Deliverables:
- 1 Instagram Reel
- 3 Instagram Stories

Posting Schedule:
Post between June 10 and June 14 after approval.

Approval Requirements:
Brand must approve draft 48 hours before posting.

Revision Requirements:
One round of light edits is included.

Competitor Restrictions:
- Do not feature other retinol products in the same post.

Links and Assets:
- https://acme.example.com/brief
- Product imagery folder

Required Claims:
- Clinically tested

Instagram Handle: @acmebeautycreator
`,
      {
        fileName: "acme-beauty-deliverables-brief.pdf",
      }
    );

    expect(result.classification.documentKind).toBe("deliverables_brief");
    expect(result.extraction.data.briefData).toMatchObject({
      deliverablesSummary: expect.stringContaining("1 Instagram Reel"),
      postingSchedule: expect.stringContaining("June 10"),
      approvalRequirements: expect.stringContaining("48 hours"),
      revisionRequirements: expect.stringContaining("One round"),
      creatorHandle: "@acmebeautycreator",
    });
    expect(result.extraction.data.briefData?.deliverablePlatforms).toEqual(
      expect.arrayContaining(["Instagram"])
    );
    expect(result.extraction.data.briefData?.competitorRestrictions).toEqual(
      expect.arrayContaining(["Do not feature other retinol products in the same post."])
    );
    expect(result.extraction.data.briefData?.linksAndAssets).toEqual(
      expect.arrayContaining(["https://acme.example.com/brief", "Product imagery folder"])
    );
    expect(result.extraction.data.briefData?.requiredClaims).toEqual(
      expect.arrayContaining(["Clinically tested"])
    );
  });

  test("extracts pitch deck guidance from weakly structured headings", () => {
    const result = fallbackAnalyzeDocument(
      `
Pitch Deck
GlowLab
Night Repair Serum Launch

Target Audience:
Women 28-40 who want a quick nighttime routine.

Tone & Style:
Confident, clean, and dermatologist-adjacent.

Do Not Mention:
- Prescription-strength claims
- Medical outcomes

Links and Assets:
- Campaign deck in Drive
- Approved product close-up images

Reporting Requirements:
Share 7-day view, reach, and saves.

Campaign Live Date: July 8, 2026
`,
      {
        fileName: "glowlab-night-repair-pitch-deck.pdf",
      }
    );

    expect(result.classification.documentKind).toBe("pitch_deck");
    expect(result.extraction.data.brandName).toBe("GlowLab");
    expect(result.extraction.data.campaignName).toBe("Night Repair Serum Launch");
    expect(result.extraction.data.briefData).toMatchObject({
      targetAudience: expect.stringContaining("Women 28-40"),
      toneAndStyle: expect.stringContaining("Confident"),
      reportingRequirements: expect.stringContaining("7-day view"),
      campaignLiveDate: "July 8, 2026",
    });
    expect(result.extraction.data.briefData?.doNotMention).toEqual(
      expect.arrayContaining(["Prescription-strength claims", "Medical outcomes"])
    );
    expect(result.extraction.data.briefData?.linksAndAssets).toEqual(
      expect.arrayContaining(["Campaign deck in Drive", "Approved product close-up images"])
    );
  });

  test("extracts operational payment, amplification, and reporting details from campaign briefs", () => {
    const result = fallbackAnalyzeDocument(
      `
Campaign Brief
Velvet Kitchen
Spring Recipe Sprint

Campaign Flight:
April 1, 2026 through May 15, 2026

Payment Schedule:
50% on signature and 50% after final post goes live.

Payment Requirements:
Creator must submit invoice and W-9 through the brand portal.

Amplification Period:
Brand may amplify approved posts for 30 days after go-live.

Reporting Requirements:
Share 7-day impressions, saves, and click-through rate.

Do Not Mention:
- Competing cookware brands
- Medical or weight-loss claims
`,
      {
        fileName: "velvet-kitchen-spring-recipe-brief.pdf",
      }
    );

    expect(result.classification.documentKind).toBe("campaign_brief");
    expect(result.extraction.data.brandName).toBe("Velvet Kitchen");
    expect(result.extraction.data.campaignName).toBe("Spring Recipe Sprint");
    expect(result.extraction.data.briefData).toMatchObject({
      campaignFlight: expect.stringContaining("April 1"),
      paymentSchedule: expect.stringContaining("50% on signature"),
      paymentRequirements: expect.stringContaining("invoice and W-9"),
      amplificationPeriod: expect.stringContaining("30 days"),
      reportingRequirements: expect.stringContaining("7-day impressions"),
    });
    expect(result.extraction.data.briefData?.doNotMention).toEqual(
      expect.arrayContaining(["Competing cookware brands", "Medical or weight-loss claims"])
    );
  });
});
