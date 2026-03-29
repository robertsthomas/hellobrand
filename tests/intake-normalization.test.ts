import { describe, expect, test } from "vitest";

import { buildNormalizedIntakeRecord } from "@/lib/intake-normalization";
import { createSeedStore } from "@/lib/repository/seed";
import type { DealAggregate } from "@/lib/types";

function createAggregate(): DealAggregate {
  const seed = createSeedStore();

  return {
    deal: seed.deals[0],
    latestDocument: seed.documents[0],
    documents: seed.documents,
    terms: seed.dealTerms[0],
    conflictResults: [],
    paymentRecord: null,
    riskFlags: seed.riskFlags,
    emailDrafts: seed.emailDrafts,
    jobs: seed.jobs,
    documentSections: seed.documentSections,
    extractionResults: seed.extractionResults,
    extractionEvidence: seed.extractionEvidence,
    summaries: seed.summaries,
    currentSummary: seed.summaries[0],
    intakeSession: null
  };
}

describe("intake normalization", () => {
  test("cleans placeholder contract extractions with filename and payment heuristics", () => {
    const aggregate = createAggregate();
    aggregate.deal.brandName = "Untitled brand";
    aggregate.deal.campaignName = "Untitled deal";
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "OREO Cakesters _ @therobertscasa Agreement.pdf",
        documentKind: "contract",
        normalizedText: `
          TALENT SERVICE AGREEMENT
          Client Name Mondelez
          Brand Name (if any) Oreo Cakesters
          Agreed to and accepted by: $3200 Three Thousand Two Hundred USD
        `,
        rawText: `
          TALENT SERVICE AGREEMENT
          Client Name Mondelez
          Brand Name (if any) Oreo Cakesters
          Agreed to and accepted by: $3200 Three Thousand Two Hundred USD
        `
      }
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Name",
      agencyName: "Name",
      campaignName: "Client NameMondelez",
      paymentAmount: 320,
      deliverables: []
    };
    aggregate.extractionEvidence = [
      {
        ...aggregate.extractionEvidence[0],
        fieldPath: "brandName",
        snippet: "Brand Name (if any) Oreo Cakesters"
      },
      {
        ...aggregate.extractionEvidence[0],
        id: "payment-evidence",
        fieldPath: "paymentAmount",
        snippet: "Agreed to and accepted by: $3200 Three Thousand Two Hundred USD"
      }
    ];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.brandName).toContain("OREO");
    expect(normalized?.contractTitle).toContain("OREO Cakesters");
    expect(normalized?.paymentAmount).toBe(3200);
    expect(normalized?.agencyName).toBeNull();
    expect(normalized?.brandCategory).toBe("sports_outdoors");
  });

  test("extracts agency contact and timeline from campaign offer emails", () => {
    const aggregate = createAggregate();
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "pampers-offer-email.txt",
        documentKind: "email_thread",
        normalizedText: `
          Pampers Swaddlers 360
          Deliverables: (1) TikTok featuring Pampers Swaddlers 360
          Timing: Video Idea/Outline Due 48 hrs after accepting campaign, video & caption drafts due for review by 6/18, and content live approx 6/24
          Compensation: $2800 + product stipend

          --
          Amber Logan
          Campaign Activation Manager, Media
          Aki Technologies
          amber.logan@inmar.com
          312-555-0101
        `,
        rawText: `
          Pampers Swaddlers 360
          Deliverables: (1) TikTok featuring Pampers Swaddlers 360
          Timing: Video Idea/Outline Due 48 hrs after accepting campaign, video & caption drafts due for review by 6/18, and content live approx 6/24
          Compensation: $2800 + product stipend

          --
          Amber Logan
          Campaign Activation Manager, Media
          Aki Technologies
          amber.logan@inmar.com
          312-555-0101
        `
      }
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: null,
      agencyName: null,
      campaignName: null,
      paymentAmount: null,
      deliverables: []
    };
    aggregate.extractionEvidence = [];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.brandName).toContain("Pampers");
    expect(normalized?.primaryContact.name).toBe("Amber Logan");
    expect(normalized?.primaryContact.email).toBe("amber.logan@inmar.com");
    expect(normalized?.agencyName).toBe("Aki Technologies");
    expect(normalized?.timelineItems.length).toBeGreaterThan(0);
    expect(normalized?.paymentAmount).toBe(2800);
  });

  test("splits markdown-style heading leakage out of brand and campaign labels", () => {
    const aggregate = createAggregate();
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Amazon Kids ## Stories with Alexa",
      campaignName: "Amazon Kids ## Stories with Alexa"
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.brandName).toBe("Amazon Kids");
    expect(normalized?.contractTitle).toBe("Amazon Kids - Stories with Alexa");
  });

  test("drops invalid extracted brand and agency placeholders and falls back to the brief header", () => {
    const aggregate = createAggregate();
    aggregate.deal.brandName = "Workspace";
    aggregate.deal.campaignName = "New workspace";
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "Amazon Kids Influencer Brief_ Stories with Alexa.docx",
        documentKind: "campaign_brief",
        normalizedText: `
          Amazon Kids Influencer Brief
          Stories with Alexa
          Overview: We’re partnering with creators like you to highlight the exciting features of Alexa+ on kids Echo devices.
        `,
        rawText: `
          Amazon Kids Influencer Brief
          Stories with Alexa
          Overview: We’re partnering with creators like you to highlight the exciting features of Alexa+ on kids Echo devices.
        `
      }
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Workspace",
      agencyName: "Agency or management company",
      campaignName: "Stories with Alexa"
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.brandName).toBe("Amazon Kids");
    expect(normalized?.agencyName).toBeNull();
    expect(normalized?.contractTitle).toBe("Amazon Kids - Stories with Alexa");
  });

  test("does not treat campaign brief bullets as a primary contact title", () => {
    const aggregate = createAggregate();
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "Amazon Kids Influencer Brief_ Stories with Alexa.docx",
        documentKind: "campaign_brief",
        normalizedText: `
          Amazon Kids Influencer Brief
          Stories with Alexa
          If for any reason you are unsure of the device name, please reach out to the campaign manager for clarity.
          Children under 13 can be shown interacting with the device so long as the marketing is clear that (1) the device is in Amazon Kids+ on Alexa mode when the child is interacting with it, and (2) the children depicted are no younger than 3.
        `,
        rawText: `
          Amazon Kids Influencer Brief
          Stories with Alexa
          If for any reason you are unsure of the device name, please reach out to the campaign manager for clarity.
          Children under 13 can be shown interacting with the device so long as the marketing is clear that (1) the device is in Amazon Kids+ on Alexa mode when the child is interacting with it, and (2) the children depicted are no younger than 3.
        `
      }
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Amazon Kids",
      agencyName: null,
      campaignName: "Stories with Alexa"
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.primaryContact.name).toBeNull();
    expect(normalized?.primaryContact.title).toBeNull();
    expect(normalized?.primaryContact.email).toBeNull();
  });

  test("filters boilerplate contract delivery clauses out of timeline items", () => {
    const aggregate = createAggregate();
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "oreo-agreement.pdf",
        documentKind: "contract",
        normalizedText: `
          XIV. Edit: shall refer to the refinement of visual and auditory components within the Content production to attain a polished final product.
          submitted Content by the Talent. It shall include the reproduction of scenes, dialogue, and/or visual sequences captured in the initial filming.
          3.1 In consideration of the payment of the Fees (Payment), Talent shall deliver the Content to the Company by the relevant Delivery Date in accordance with the brief.
          3.2 Talent shall cooperate fully with Company and any third parties appointed by Company as necessary to deliver the Content and provide the services.
          Services. Time is of the essence in relation to any delivery date.
          Campaign Live date: 07/08
          Video & caption drafts due for review by 6/18
          Video Idea/Outline Due 48 hrs after accepting campaign
        `,
        rawText: `
          XIV. Edit: shall refer to the refinement of visual and auditory components within the Content production to attain a polished final product.
          submitted Content by the Talent. It shall include the reproduction of scenes, dialogue, and/or visual sequences captured in the initial filming.
          3.1 In consideration of the payment of the Fees (Payment), Talent shall deliver the Content to the Company by the relevant Delivery Date in accordance with the brief.
          3.2 Talent shall cooperate fully with Company and any third parties appointed by Company as necessary to deliver the Content and provide the services.
          Services. Time is of the essence in relation to any delivery date.
          Campaign Live date: 07/08
          Video & caption drafts due for review by 6/18
          Video Idea/Outline Due 48 hrs after accepting campaign
        `
      }
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      deliverables: []
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.timelineItems).toHaveLength(3);
    expect(normalized?.timelineItems.map((item) => item.label)).toEqual([
      "Outline due",
      "Draft due",
      "Go live"
    ]);
    expect(normalized?.timelineItems.map((item) => item.date)).toEqual([
      "48 hrs after",
      "6/18",
      "07/08"
    ]);
  });

  test("does not treat contract agency text as analytics", () => {
    const aggregate = createAggregate();
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "oreo-agreement.pdf",
        documentKind: "contract",
        normalizedText: `
          Manager/Agency on behalf of Talent
          Manager/Agency
          Usage Term:
          90 days paid and organic usage with additional organic usage on
          Usage Platforms TikTok (Paid and organic) Meta and YT shorts (Organic)
          Document Ref: HYTE8-UHE7G-BAWAO-PDRF4
        `,
        rawText: `
          Manager/Agency on behalf of Talent
          Manager/Agency
          Usage Term:
          90 days paid and organic usage with additional organic usage on
          Usage Platforms TikTok (Paid and organic) Meta and YT shorts (Organic)
          Document Ref: HYTE8-UHE7G-BAWAO-PDRF4
        `
      }
    ];
    aggregate.latestDocument = aggregate.documents[0];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.analytics).toBeNull();
  });
});
