import type { AppStore, DealTermsRecord } from "@/lib/types";

function createSeedTerms(now: string): DealTermsRecord {
  return {
    id: "terms-demo-deal",
    dealId: "demo-deal",
    brandName: "Nimbus Athletics",
    agencyName: null,
    creatorName: "Demo Creator",
    campaignName: "Spring Recovery Drop",
    paymentAmount: 2000,
    currency: "USD",
    paymentTerms: "Net 45",
    paymentStructure: "Flat fee",
    netTermsDays: 45,
    paymentTrigger: "Within 45 days of invoice receipt",
    deliverables: [
      {
        id: "deliverable-1",
        title: "Instagram Reel",
        dueDate: "2026-03-30",
        channel: "Instagram",
        quantity: 1,
        status: "pending",
        description: "30-second product feature reel"
      },
      {
        id: "deliverable-2",
        title: "Instagram Story Frames",
        dueDate: "2026-03-31",
        channel: "Instagram",
        quantity: 2,
        status: "pending",
        description: "Story support frames with swipe-up"
      }
    ],
    usageRights: "Organic reposting plus 6 months of paid social usage.",
    usageRightsOrganicAllowed: true,
    usageRightsPaidAllowed: true,
    whitelistingAllowed: null,
    usageDuration: "6 months",
    usageTerritory: "United States",
    usageChannels: ["Instagram", "Paid social"],
    exclusivity: "30-day category exclusivity for athletic footwear.",
    exclusivityApplies: true,
    exclusivityCategory: "Athletic footwear",
    exclusivityDuration: "30 days",
    exclusivityRestrictions: "No competitive footwear partnerships.",
    brandCategory: "sports_outdoors",
    competitorCategories: ["Sports & outdoors"],
    restrictedCategories: ["Sports & outdoors"],
    campaignDateWindow: {
      startDate: "2026-03-30T00:00:00.000Z",
      endDate: "2026-03-31T00:00:00.000Z",
      postingWindow: "2026-03-30 to 2026-03-31"
    },
    disclosureObligations: [
      {
        id: "disclosure-1",
        title: "Disclosure required",
        detail: "Use a paid partnership label or #ad when posting sponsored content.",
        source: "Sponsored social content must include clear disclosure."
      }
    ],
    revisions: "One round of revisions.",
    revisionRounds: 1,
    termination: "Brand may terminate with 7 days notice before content is submitted.",
    terminationAllowed: true,
    terminationNotice: "7 days",
    terminationConditions: "Before content submission",
    governingLaw: "New York",
    notes: "Creator should confirm whether paid usage includes whitelisting.",
    manuallyEditedFields: [],
    briefData: null,
    pendingExtraction: null,
    createdAt: now,
    updatedAt: now
  };
}

export function createSeedStore(): AppStore {
  const now = new Date().toISOString();
  const terms = createSeedTerms(now);

  return {
    users: [
      {
        id: "demo-user",
        email: "demo@hellobrand.app",
        displayName: "Demo Creator",
        mode: "demo"
      }
    ],
    deals: [
      {
        id: "demo-deal",
        userId: "demo-user",
        brandName: "Nimbus Athletics",
        campaignName: "Spring Recovery Drop",
        status: "negotiating",
        paymentStatus: "invoiced",
        countersignStatus: "pending",
        summary:
          "You are being paid $2,000 for one Instagram Reel and two Story frames. The biggest watchouts are Net 45 payment terms and six months of paid ad usage.",
        legalDisclaimer:
          "HelloBrand provides plain-English contract understanding and negotiation prep. It is not legal advice.",
        nextDeliverableDate: "2026-03-30",
        createdAt: now,
        updatedAt: now,
        analyzedAt: now,
        confirmedAt: now
      }
    ],
    documents: [
      {
        id: "demo-document",
        dealId: "demo-deal",
        userId: "demo-user",
        fileName: "nimbus-spring-contract.pdf",
        mimeType: "application/pdf",
        storagePath: "demo/nimbus-spring-contract.pdf",
        processingStatus: "ready",
        rawText:
          "Creator Agreement\nCompensation\nBrand shall pay Creator $2,000 net 45 after invoice. Deliverables include 1 Instagram Reel and 2 Story frames. Brand receives 6 months paid social usage. Exclusivity for athletic footwear lasts 30 days.",
        normalizedText:
          "Creator Agreement\n\nCompensation\nBrand shall pay Creator $2,000 net 45 after invoice.\n\nDeliverables\n1 Instagram Reel and 2 Story frames.\n\nUsage Rights\nBrand receives 6 months paid social usage.\n\nExclusivity\nAthletic footwear category exclusivity lasts 30 days.",
        documentKind: "contract",
        classificationConfidence: 0.98,
        sourceType: "file",
        errorMessage: null,
        createdAt: now,
        updatedAt: now
      }
    ],
    dealTerms: [terms],
    riskFlags: [
      {
        id: "risk-1",
        dealId: "demo-deal",
        category: "payment_terms",
        title: "Long payment window",
        detail: "Net 45 is slower than many creator deals and may affect cash flow.",
        severity: "medium",
        suggestedAction: "Ask whether payment can be moved to Net 15 or Net 30.",
        evidence: ["Brand shall pay Creator $2,000 net 45 after invoice."],
        sourceDocumentId: "demo-document",
        createdAt: now
      },
      {
        id: "risk-2",
        dealId: "demo-deal",
        category: "usage_rights",
        title: "Paid usage included",
        detail:
          "The brand can use your content in paid social for 6 months without separate compensation listed.",
        severity: "high",
        suggestedAction: "Limit paid usage term or request added compensation for ads.",
        evidence: ["Brand receives 6 months paid social usage."],
        sourceDocumentId: "demo-document",
        createdAt: now
      }
    ],
    emailDrafts: [
      {
        id: "draft-1",
        dealId: "demo-deal",
        intent: "request-faster-payment",
        subject: "Payment Terms Clarification",
        body:
          "Hi Nimbus team,\n\nThanks again for sending the agreement. I noticed the current payment terms are Net 45. Would you be open to revising them to Net 15 so the payment timing aligns with the campaign timeline?\n\nAppreciate it,\nDemo Creator",
        createdAt: now,
        updatedAt: now
      }
    ],
    emailAccounts: [],
    emailThreads: [],
    emailMessages: [],
    emailSyncStates: [],
    dealEmailLinks: [],
    emailCandidateMatches: [],
    emailDealEvents: [],
    emailDealTermSuggestions: [],
    assistantThreads: [],
    assistantMessages: [],
    assistantContextSnapshots: [],
    jobs: [
      {
        id: "job-1",
        dealId: "demo-deal",
        documentId: "demo-document",
        type: "generate_summary",
        status: "ready",
        attemptCount: 1,
        createdAt: now,
        updatedAt: now,
        failureReason: null
      }
    ],
    documentSections: [
      {
        id: "section-1",
        documentId: "demo-document",
        title: "Compensation",
        content: "Brand shall pay Creator $2,000 net 45 after invoice.",
        chunkIndex: 0,
        pageRange: "1",
        createdAt: now
      },
      {
        id: "section-2",
        documentId: "demo-document",
        title: "Deliverables",
        content: "1 Instagram Reel and 2 Story frames.",
        chunkIndex: 1,
        pageRange: "1",
        createdAt: now
      }
    ],
    extractionResults: [
      {
        id: "extract-1",
        documentId: "demo-document",
        schemaVersion: "v1",
        model: "fallback",
        confidence: 0.82,
        conflicts: [],
        data: {
          brandName: terms.brandName,
          agencyName: terms.agencyName,
          creatorName: terms.creatorName,
          campaignName: terms.campaignName,
          paymentAmount: terms.paymentAmount,
          currency: terms.currency,
          paymentTerms: terms.paymentTerms,
          paymentStructure: terms.paymentStructure,
          netTermsDays: terms.netTermsDays,
          paymentTrigger: terms.paymentTrigger,
          deliverables: terms.deliverables,
          usageRights: terms.usageRights,
          usageRightsOrganicAllowed: terms.usageRightsOrganicAllowed,
          usageRightsPaidAllowed: terms.usageRightsPaidAllowed,
          whitelistingAllowed: terms.whitelistingAllowed,
          usageDuration: terms.usageDuration,
          usageTerritory: terms.usageTerritory,
          usageChannels: terms.usageChannels,
          exclusivity: terms.exclusivity,
          exclusivityApplies: terms.exclusivityApplies,
          exclusivityCategory: terms.exclusivityCategory,
          exclusivityDuration: terms.exclusivityDuration,
          exclusivityRestrictions: terms.exclusivityRestrictions,
          brandCategory: terms.brandCategory,
          competitorCategories: terms.competitorCategories,
          restrictedCategories: terms.restrictedCategories,
          campaignDateWindow: terms.campaignDateWindow,
          disclosureObligations: terms.disclosureObligations,
          revisions: terms.revisions,
          revisionRounds: terms.revisionRounds,
          termination: terms.termination,
          terminationAllowed: terms.terminationAllowed,
          terminationNotice: terms.terminationNotice,
          terminationConditions: terms.terminationConditions,
          governingLaw: terms.governingLaw,
          notes: terms.notes,
          manuallyEditedFields: terms.manuallyEditedFields,
          briefData: terms.briefData
        },
        createdAt: now
      }
    ],
    extractionEvidence: [
      {
        id: "evidence-1",
        documentId: "demo-document",
        fieldPath: "paymentAmount",
        snippet: "Brand shall pay Creator $2,000 net 45 after invoice.",
        sectionId: "section-1",
        confidence: 0.88,
        createdAt: now
      },
      {
        id: "evidence-2",
        documentId: "demo-document",
        fieldPath: "usageRightsPaidAllowed",
        snippet: "Brand receives 6 months paid social usage.",
        sectionId: null,
        confidence: 0.81,
        createdAt: now
      }
    ],
    summaries: [
      {
        id: "summary-1",
        dealId: "demo-deal",
        documentId: "demo-document",
        body:
          "This deal appears to pay $2,000 for one Instagram Reel and two Story frames. Payment is Net 45 after invoice, and the brand receives six months of paid social usage with a 30-day footwear exclusivity period.",
        version: "v1",
        createdAt: now
      }
    ]
  };
}
