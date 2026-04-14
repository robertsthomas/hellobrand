import { describe, expect, test } from "vitest";

import { buildNormalizedIntakeRecord, INTAKE_NORMALIZED_VERSION } from "@/lib/intake-normalization";
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
    jobs: seed.jobs,
    documentSections: seed.documentSections,
    documentRuns: seed.documentRuns,
    documentArtifacts: seed.documentArtifacts,
    documentFieldEvidence: seed.documentFieldEvidence,
    documentReviewItems: seed.documentReviewItems,
    extractionResults: seed.extractionResults,
    extractionEvidence: seed.extractionEvidence,
    summaries: seed.summaries,
    currentSummary: seed.summaries[0],
    intakeSession: null,
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
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Name",
      agencyName: "Name",
      campaignName: "Client NameMondelez",
      paymentAmount: 320,
      deliverables: [],
    };
    aggregate.extractionEvidence = [
      {
        ...aggregate.extractionEvidence[0],
        fieldPath: "brandName",
        snippet: "Brand Name (if any) Oreo Cakesters",
      },
      {
        ...aggregate.extractionEvidence[0],
        id: "payment-evidence",
        fieldPath: "paymentAmount",
        snippet: "Agreed to and accepted by: $3200 Three Thousand Two Hundred USD",
      },
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
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: null,
      agencyName: null,
      campaignName: null,
      paymentAmount: null,
      deliverables: [],
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
      campaignName: "Amazon Kids ## Stories with Alexa",
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
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Workspace",
      agencyName: "Agency or management company",
      campaignName: "Stories with Alexa",
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.brandName).toBe("Amazon Kids");
    expect(normalized?.agencyName).toBeNull();
    expect(normalized?.contractTitle).toBe("Amazon Kids - Stories with Alexa");
  });

  test("does not keep generic influencer labels as the brand name", () => {
    const aggregate = createAggregate();
    aggregate.deal.brandName = "Workspace";
    aggregate.deal.campaignName = "New workspace";
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "NimbusPM_influencer_brief.pdf",
        documentKind: "campaign_brief",
        normalizedText: `
          Influencer Brief
          NimbusPM
          Overview: Create content for the NimbusPM summer push.
        `,
        rawText: `
          Influencer Brief
          NimbusPM
          Overview: Create content for the NimbusPM summer push.
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Influencer",
      agencyName: null,
      campaignName: null,
    };
    aggregate.extractionEvidence = [
      {
        ...aggregate.extractionEvidence[0],
        fieldPath: "brandName",
        snippet: "Influencer",
      },
    ];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.brandName).toBe("NimbusPM");
  });

  test("ignores generic usage headings and keeps the real brand and campaign", () => {
    const aggregate = createAggregate();
    aggregate.deal.brandName = "Workspace";
    aggregate.deal.campaignName = "New workspace";
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "NimbusPM_influencer_brief.pdf",
        documentKind: "campaign_brief",
        normalizedText: `
          Influencer Brief
          NimbusPM
          Summer Push
          Overview: Create content for the NimbusPM summer push.
        `,
        rawText: `
          Influencer Brief
          NimbusPM
          Summer Push
          Overview: Create content for the NimbusPM summer push.
        `,
      },
      {
        ...aggregate.documents[1],
        fileName: "usage_rights_addendum.pdf",
        documentKind: "contract",
        normalizedText: `
          Brand Usage Rights
          Campaign Overview
          The brand receives 90 days paid and organic usage.
        `,
        rawText: `
          Brand Usage Rights
          Campaign Overview
          The brand receives 90 days paid and organic usage.
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[1];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Usage",
      agencyName: null,
      campaignName: "Overview",
    };
    aggregate.extractionEvidence = [
      {
        ...aggregate.extractionEvidence[0],
        fieldPath: "brandName",
        snippet: "Usage",
      },
      {
        ...aggregate.extractionEvidence[0],
        id: "campaign-evidence",
        fieldPath: "campaignName",
        snippet: "Overview",
      },
    ];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.brandName).toBe("NimbusPM");
    expect(normalized?.contractTitle).toBe("NimbusPM - Summer Push");
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
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Amazon Kids",
      agencyName: null,
      campaignName: "Stories with Alexa",
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.primaryContact.name).toBeNull();
    expect(normalized?.primaryContact.title).toBeNull();
    expect(normalized?.primaryContact.email).toBeNull();
  });

  test("does not treat a role title as the primary contact name", () => {
    const aggregate = createAggregate();
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "offer-email.txt",
        documentKind: "email_thread",
        normalizedText: `
          NimbusPM
          Let's move forward on this partnership.

          --
          Campaign Manager
          Partnerships Team
          team@nimbuspm.com
        `,
        rawText: `
          NimbusPM
          Let's move forward on this partnership.

          --
          Campaign Manager
          Partnerships Team
          team@nimbuspm.com
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "NimbusPM",
      agencyName: null,
      campaignName: "Campaign",
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.primaryContact.name).toBeNull();
    expect(normalized?.primaryContact.email).toBe("team@nimbuspm.com");
  });

  test("does not use creator profile contact details as the primary contact", () => {
    const aggregate = createAggregate();
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "@therobertscasa Agreement.pdf",
        documentKind: "contract",
        normalizedText: `
          Talent
          Thomas Roberts
          Campaign Manager, Partnerships Lead, Agent
          thomas@example.com
          909-743-1880
        `,
        rawText: `
          Talent
          Thomas Roberts
          Campaign Manager, Partnerships Lead, Agent
          thomas@example.com
          909-743-1880
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.summaries = [];

    const normalized = buildNormalizedIntakeRecord(aggregate, {
      excludedPrimaryContactEmails: ["thomas@example.com"],
      excludedPrimaryContactNames: ["Thomas Roberts"],
    });

    expect(normalized?.primaryContact.name).toBeNull();
    expect(normalized?.primaryContact.title).toBeNull();
    expect(normalized?.primaryContact.email).toBeNull();
    expect(normalized?.primaryContact.phone).toBeNull();
  });

  test("uses structured brief contact when a persisted contact matches the creator profile", () => {
    const aggregate = createAggregate();
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Lunchables",
      agencyName: null,
      briefData: {
        campaignOverview: "Back to school lunch content.",
        messagingPoints: [],
        talkingPoints: [],
        creativeConceptOverview: null,
        brandGuidelines: null,
        approvalRequirements: null,
        targetAudience: null,
        toneAndStyle: null,
        doNotMention: [],
        brandContactName: "Jordan Ellis",
        brandContactTitle: "Partnerships Manager",
        brandContactEmail: "jordan@lunchables.com",
        brandContactPhone: "312-555-0199",
        sourceDocumentIds: ["brief-document"],
      },
    };
    aggregate.summaries = [
      {
        ...aggregate.summaries[0],
        id: "persisted-intake",
        version: INTAKE_NORMALIZED_VERSION,
        body: JSON.stringify({
          primaryContact: {
            organizationType: "brand",
            name: "Thomas Roberts",
            title: "Creator",
            email: "thomas@example.com",
            phone: "909-743-1880",
          },
        }),
      },
    ];

    const normalized = buildNormalizedIntakeRecord(aggregate, {
      excludedPrimaryContactEmails: ["thomas@example.com"],
      excludedPrimaryContactNames: ["Thomas Roberts"],
    });

    expect(normalized?.primaryContact.organizationType).toBe("brand");
    expect(normalized?.primaryContact.name).toBe("Jordan Ellis");
    expect(normalized?.primaryContact.title).toBe("Partnerships Manager");
    expect(normalized?.primaryContact.email).toBe("jordan@lunchables.com");
    expect(normalized?.primaryContact.phone).toBe("312-555-0199");
  });

  test("uses structured brief contact when the previous normalized contact was empty", () => {
    const aggregate = createAggregate();
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Lunchables",
      agencyName: null,
      briefData: {
        campaignOverview: "Back to school lunch content.",
        messagingPoints: [],
        talkingPoints: [],
        creativeConceptOverview: null,
        brandGuidelines: null,
        approvalRequirements: null,
        targetAudience: null,
        toneAndStyle: null,
        doNotMention: [],
        brandContactEmail: "jordan@lunchables.com",
        sourceDocumentIds: ["brief-document"],
      },
    };
    aggregate.summaries = [
      {
        ...aggregate.summaries[0],
        id: "persisted-intake-empty-contact",
        version: INTAKE_NORMALIZED_VERSION,
        body: JSON.stringify({
          primaryContact: {
            organizationType: "brand",
            name: null,
            title: null,
            email: null,
            phone: null,
          },
        }),
      },
    ];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.primaryContact.organizationType).toBe("brand");
    expect(normalized?.primaryContact.email).toBe("jordan@lunchables.com");
  });

  test("does not attach a creator phone to a brand contact block", () => {
    const aggregate = createAggregate();
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Lunchables",
      agencyName: null,
    };
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "lunchables-contract.pdf",
        documentKind: "contract",
        normalizedText: `
          Creator:
          Thomas Roberts
          thomas@example.com
          909-743-1880

          Brand Contact:
          Jordan Ellis
          Partnerships Manager
          jordan@lunchables.com
        `,
        rawText: `
          Creator:
          Thomas Roberts
          thomas@example.com
          909-743-1880

          Brand Contact:
          Jordan Ellis
          Partnerships Manager
          jordan@lunchables.com
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];

    const normalized = buildNormalizedIntakeRecord(aggregate, {
      excludedPrimaryContactEmails: ["thomas@example.com"],
      excludedPrimaryContactNames: ["Thomas Roberts"],
    });

    expect(normalized?.primaryContact.organizationType).toBe("brand");
    expect(normalized?.primaryContact.name).toBe("Jordan Ellis");
    expect(normalized?.primaryContact.title).toBe("Partnerships Manager");
    expect(normalized?.primaryContact.email).toBe("jordan@lunchables.com");
    expect(normalized?.primaryContact.phone).toBeNull();
  });

  test("extracts an agency signature block as one coherent contact", () => {
    const aggregate = createAggregate();
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Pampers",
      agencyName: "Aki Technologies",
    };
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "pampers-signature-block.pdf",
        documentKind: "contract",
        normalizedText: `
          For campaign approvals and production questions:

          Amber Logan
          Campaign Activation Manager, Media
          Aki Technologies
          amber.logan@inmar.com
          312-555-0101
        `,
        rawText: `
          For campaign approvals and production questions:

          Amber Logan
          Campaign Activation Manager, Media
          Aki Technologies
          amber.logan@inmar.com
          312-555-0101
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.primaryContact.organizationType).toBe("agency");
    expect(normalized?.primaryContact.name).toBe("Amber Logan");
    expect(normalized?.primaryContact.title).toBe("Campaign Activation Manager, Media");
    expect(normalized?.primaryContact.email).toBe("amber.logan@inmar.com");
    expect(normalized?.primaryContact.phone).toBe("312-555-0101");
  });

  test("keeps primary contact blank when only creator contact details are present", () => {
    const aggregate = createAggregate();
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "Lunchables",
      agencyName: null,
    };
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "creator-only-contract.pdf",
        documentKind: "contract",
        normalizedText: `
          Creator:
          Thomas Roberts
          thomas@example.com
          909-743-1880
        `,
        rawText: `
          Creator:
          Thomas Roberts
          thomas@example.com
          909-743-1880
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];

    const normalized = buildNormalizedIntakeRecord(aggregate, {
      excludedPrimaryContactEmails: ["thomas@example.com"],
      excludedPrimaryContactNames: ["Thomas Roberts"],
    });

    expect(normalized?.primaryContact.name).toBeNull();
    expect(normalized?.primaryContact.title).toBeNull();
    expect(normalized?.primaryContact.email).toBeNull();
    expect(normalized?.primaryContact.phone).toBeNull();
  });

  test("does not use a generic campaign label as the contract title", () => {
    const aggregate = createAggregate();
    aggregate.terms = {
      ...aggregate.terms!,
      brandName: "NimbusPM",
      campaignName: "Campaign",
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.contractTitle).not.toBe("NimbusPM - Campaign");
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
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];
    aggregate.terms = {
      ...aggregate.terms!,
      deliverables: [],
    };

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.timelineItems).toHaveLength(3);
    expect(normalized?.timelineItems.map((item) => item.label)).toEqual([
      "Outline due",
      "Draft due",
      "Go live",
    ]);
    expect(normalized?.timelineItems.map((item) => item.date)).toEqual([
      "48 hrs after",
      "6/18",
      "07/08",
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
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.analytics).toBeNull();
  });

  test("extracts analytics highlights from performance reports", () => {
    const aggregate = createAggregate();
    aggregate.documents = [
      {
        ...aggregate.documents[0],
        fileName: "performance_report.pdf",
        documentKind: "unknown",
        normalizedText: `
          LumaSkin Performance Summary
          Topline Metrics
          Impressions
          400,327
          Clicks
          5,766
          CTR
          1.44%
          Attributed conversions
          334
          Analyst Notes
          • Strongest retention typically came from direct problem-solution intros.
          • Assets with visible product demo outperformed talking-head-only variants.
        `,
        rawText: `
          LumaSkin Performance Summary
          Topline Metrics
          Impressions
          400,327
          Clicks
          5,766
          CTR
          1.44%
          Attributed conversions
          334
          Analyst Notes
          • Strongest retention typically came from direct problem-solution intros.
          • Assets with visible product demo outperformed talking-head-only variants.
        `,
      },
    ];
    aggregate.latestDocument = aggregate.documents[0];

    const normalized = buildNormalizedIntakeRecord(aggregate);

    expect(normalized?.analytics?.highlights).toContain("Impressions: 400,327");
    expect(normalized?.analytics?.highlights).toContain("Clicks: 5,766");
    expect(normalized?.analytics?.highlights).toContain("CTR: 1.44%");
    expect(normalized?.analytics?.highlights).toContain("Attributed conversions: 334");
    expect(normalized?.analytics?.highlights).toContain(
      "Strongest retention typically came from direct problem-solution intros."
    );
  });
});
