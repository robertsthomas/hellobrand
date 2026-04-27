import { describe, expect, test } from "vitest";

import { buildConceptContext } from "@/lib/analysis/normalizers";
import type { DealAggregate } from "@/lib/types";

function makeAggregate(): DealAggregate {
  return {
    deal: {
      id: "deal_123",
      userId: "user_123",
      brandName: "Northstar Skin",
      campaignName: "Mirror Swap",
      status: "deliverables_pending",
      paymentStatus: "awaiting_payment",
      countersignStatus: "signed",
      summary: "A skincare campaign focused on texture, glow, and routine integration.",
      legalDisclaimer: "",
      nextDeliverableDate: "2026-05-10",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      analyzedAt: null,
      confirmedAt: null,
      statusBeforeArchive: null,
    },
    latestDocument: null,
    documents: [
      {
        id: "doc_pitch",
        dealId: "deal_123",
        userId: "user_123",
        fileName: "brand-moodboard.pdf",
        mimeType: "application/pdf",
        storagePath: "docs/brand-moodboard.pdf",
        fileSizeBytes: 1024,
        checksumSha256: null,
        processingStatus: "ready",
        rawText: "Warm bathroom lighting, mirror shots, clean neutral countertop, soft green towel.",
        normalizedText:
          "Warm bathroom lighting, mirror shots, clean neutral countertop, soft green towel.",
        documentKind: "pitch_deck",
        classificationConfidence: 0.9,
        sourceType: "file",
        errorMessage: null,
        processingRunId: null,
        processingRunStateJson: null,
        processingStartedAt: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    terms: {
      id: "terms_123",
      dealId: "deal_123",
      brandName: "Northstar Skin",
      agencyName: null,
      creatorName: "Taylor",
      campaignName: "Mirror Swap",
      paymentAmount: 7500,
      currency: "USD",
      paymentTerms: "Net 30",
      paymentStructure: "flat_fee",
      netTermsDays: 30,
      paymentTrigger: "final approval",
      deliverables: [
        {
          id: "del_1",
          title: "TikTok routine video",
          dueDate: "2026-05-10",
          channel: "TikTok",
          quantity: 1,
          description: "30-45 second skincare routine concept",
        },
      ],
      usageRights: "Organic social for 90 days",
      usageRightsOrganicAllowed: true,
      usageRightsPaidAllowed: false,
      whitelistingAllowed: false,
      usageDuration: "90 days",
      usageTerritory: "US",
      usageChannels: ["TikTok", "Instagram"],
      exclusivity: "Skincare serums",
      exclusivityApplies: true,
      exclusivityCategory: "Skincare",
      exclusivityDuration: "30 days",
      exclusivityRestrictions: "No competing serums",
      brandCategory: "beauty_personal_care",
      competitorCategories: ["serums"],
      restrictedCategories: ["retinol"],
      campaignDateWindow: null,
      disclosureObligations: [
        {
          id: "disc_1",
          title: "FTC disclosure",
          detail: "Include #ad in caption and verbal disclosure in the opening beat.",
          source: "brief",
        },
      ],
      revisions: "1 round",
      revisionRounds: 1,
      termination: null,
      terminationAllowed: null,
      terminationNotice: null,
      terminationConditions: null,
      governingLaw: null,
      notes: "Keep the product texture shot authentic and avoid medical language.",
      manuallyEditedFields: [],
      briefData: {
        campaignOverview: "Show the serum fitting naturally into an existing night routine.",
        messagingPoints: ["Barrier support", "Fast absorption"],
        talkingPoints: ["Silky texture", "No sticky finish"],
        creativeConceptOverview: "Routine-first, not ad-first.",
        brandGuidelines: "Calm, elevated, minimal.",
        approvalRequirements: "Submit concept before filming.",
        targetAudience: "Women 22-34 interested in skincare routines",
        toneAndStyle: "Warm, honest, lightly editorial",
        doNotMention: ["acne cure"],
        deliverablesSummary: "One TikTok routine concept",
        deliverablePlatforms: ["TikTok"],
        conceptDueDate: "2026-05-03",
        draftDueDate: "2026-05-07",
        campaignLiveDate: "2026-05-15",
        contentPillars: ["routine", "texture", "bathroom vanity"],
        requiredElements: ["Show bottle", "Show texture"],
        requiredClaims: ["Barrier support"],
        visualDirection: "Soft bathroom light, mirror framing, close texture shots",
        disclosureRequirements: ["#ad in caption"],
        competitorRestrictions: ["Do not mention competing serums"],
        linksAndAssets: ["https://example.com/moodboard"],
        productName: "Northstar Barrier Serum",
        productDescription: "Lightweight nightly barrier serum",
        sourceDocumentIds: ["doc_pitch"],
      },
      pendingExtraction: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    conflictResults: [],
    paymentRecord: null,
    invoiceRecord: null,
    riskFlags: [
      {
        id: "risk_1",
        dealId: "deal_123",
        category: "usage_rights",
        title: "Broad usage wording",
        detail: "The current language is broader than the brief implies.",
        severity: "high",
        suggestedAction: "Keep concepts away from unsupported benefit claims.",
        evidence: [],
        sourceDocumentId: null,
        sourceType: null,
        sourceMessageId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    jobs: [],
    documentSections: [],
    documentRuns: [],
    documentArtifacts: [],
    documentFieldEvidence: [],
    documentReviewItems: [],
    extractionResults: [],
    extractionEvidence: [],
    summaries: [],
    currentSummary: {
      id: "summary_1",
      dealId: "deal_123",
      documentId: null,
      body: "Northstar wants creator-native routine content with clean visual references.",
      version: "v1",
      summaryType: "plain_language",
      source: "analysis",
      parentSummaryId: null,
      isCurrent: true,
      createdAt: "2026-04-01T00:00:00.000Z",
    },
    intakeSession: null,
  };
}

describe("buildConceptContext", () => {
  test("includes richer workspace context for concept generation", () => {
    const context = JSON.parse(buildConceptContext(makeAggregate(), 0)) as Record<string, unknown>;

    expect(context.workspaceSummary).toBe(
      "Northstar wants creator-native routine content with clean visual references."
    );
    expect(context.dealTerms).toMatchObject({
      paymentAmount: 7500,
      usageRights: "Organic social for 90 days",
      exclusivity: "Skincare serums",
    });
    expect(context.riskFlags).toEqual([
      expect.objectContaining({
        title: "Broad usage wording",
        detail: "The current language is broader than the brief implies.",
      }),
    ]);
    expect(context.uploadedDocuments).toEqual([
      expect.objectContaining({
        fileName: "brand-moodboard.pdf",
        looksLikeVisualReference: true,
      }),
    ]);
    expect(context.visualReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "brief_asset", value: "https://example.com/moodboard" }),
        expect.objectContaining({ type: "deck_or_visual_doc", value: "brand-moodboard.pdf" }),
      ])
    );
  });
});
