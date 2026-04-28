import { describe, expect, test } from "vitest";

import { buildThreadBrief } from "@/lib/email/thread-brief";
import type { DealAggregate, EmailMessageRecord, EmailThreadDetail } from "@/lib/types";

function createMessage(
  id: string,
  direction: EmailMessageRecord["direction"],
  textBody: string
): EmailMessageRecord {
  return {
    id,
    threadId: "thread-1",
    providerMessageId: `provider-${id}`,
    internetMessageId: null,
    from:
      direction === "inbound"
        ? { name: "Brand Team", email: "brand@example.com" }
        : { name: "Creator", email: "creator@example.com" },
    to: [
      direction === "inbound"
        ? { name: "Creator", email: "creator@example.com" }
        : { name: "Brand Team", email: "brand@example.com" },
    ],
    cc: [],
    bcc: [],
    subject: "Thread subject",
    textBody,
    htmlBody: null,
    sentAt: "2026-04-20T12:00:00.000Z",
    receivedAt: "2026-04-20T12:00:00.000Z",
    direction,
    hasAttachments: false,
    rawStorageKey: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z",
    attachments: [],
  };
}

function createThread(
  messages: EmailMessageRecord[],
  overrides?: Partial<EmailThreadDetail>
): EmailThreadDetail {
  return {
    thread: {
      id: "thread-1",
      accountId: "account-1",
      provider: "gmail",
      providerThreadId: "provider-thread-1",
      subject: "Thread subject",
      snippet: messages[messages.length - 1]?.textBody ?? null,
      participants: [{ name: "Brand Team", email: "brand@example.com" }],
      lastMessageAt: "2026-04-20T12:00:00.000Z",
      messageCount: messages.length,
      isContractRelated: true,
      aiSummary: null,
      aiSummaryUpdatedAt: null,
      workflowState: "needs_review",
      draftUpdatedAt: null,
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    },
    account: {
      id: "account-1",
      userId: "user-1",
      provider: "gmail",
      providerAccountId: "provider-account-1",
      emailAddress: "creator@example.com",
      displayName: "Creator",
      status: "connected",
      scopes: [],
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      mailAuthConfigured: true,
      tokenExpiresAt: null,
      lastSyncAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    },
    messages,
    links: [
      {
        id: "link-1",
        dealId: "deal-1",
        threadId: "thread-1",
        dealName: "BrightHome summer campaign",
        brandName: "BrightHome",
        campaignName: "Summer campaign",
        linkSource: "manual",
        role: "primary",
        confidence: 0.98,
        createdAt: "2026-04-20T12:00:00.000Z",
      },
    ],
    primaryLink: {
      id: "link-1",
      dealId: "deal-1",
      threadId: "thread-1",
      dealName: "BrightHome summer campaign",
      brandName: "BrightHome",
      campaignName: "Summer campaign",
      linkSource: "manual",
      role: "primary",
      confidence: 0.98,
      createdAt: "2026-04-20T12:00:00.000Z",
    },
    referenceLinks: [],
    importantEvents: [],
    termSuggestions: [],
    actionItems: [],
    promiseDiscrepancies: [],
    crossDealConflicts: [],
    threadBrief: null,
    savedDraft: null,
    notes: [],
    noteCount: 0,
    ...overrides,
  };
}

function createAggregate(overrides?: Partial<DealAggregate>): DealAggregate {
  return {
    deal: {
      id: "deal-1",
      userId: "user-1",
      brandName: "BrightHome",
      campaignName: "Summer campaign",
      status: "negotiating",
      paymentStatus: "awaiting_payment",
      countersignStatus: "pending",
      summary: null,
      legalDisclaimer: "",
      nextDeliverableDate: null,
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
      analyzedAt: null,
      confirmedAt: null,
      statusBeforeArchive: null,
      esignEnvelopeId: null,
      esignStatus: null,
      esignUpdatedAt: null,
    },
    latestDocument: null,
    documents: [],
    terms: {
      id: "terms-1",
      dealId: "deal-1",
      brandName: "BrightHome",
      agencyName: null,
      creatorName: "Creator",
      campaignName: "Summer campaign",
      paymentAmount: null,
      currency: "USD",
      paymentTerms: null,
      paymentStructure: null,
      netTermsDays: null,
      paymentTrigger: null,
      deliverables: [],
      usageRights: null,
      usageRightsOrganicAllowed: null,
      usageRightsPaidAllowed: null,
      whitelistingAllowed: null,
      usageDuration: null,
      usageTerritory: null,
      usageChannels: [],
      exclusivity: null,
      exclusivityApplies: null,
      exclusivityCategory: null,
      exclusivityDuration: null,
      exclusivityRestrictions: null,
      brandCategory: null,
      competitorCategories: [],
      restrictedCategories: [],
      campaignDateWindow: null,
      disclosureObligations: [],
      revisions: null,
      revisionRounds: null,
      termination: null,
      terminationAllowed: null,
      terminationNotice: null,
      terminationConditions: null,
      governingLaw: null,
      notes: null,
      manuallyEditedFields: [],
      briefData: null,
      pendingExtraction: null,
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    },
    riskFlags: [],
    conflictResults: [],
    paymentRecord: null,
    invoiceRecord: null,
    jobs: [],
    documentSections: [],
    documentRuns: [],
    documentArtifacts: [],
    documentFieldEvidence: [],
    documentReviewItems: [],
    extractionResults: [],
    extractionEvidence: [],
    summaries: [],
    currentSummary: null,
    intakeSession: null,
    ...overrides,
  };
}

describe("thread brief archetypes", () => {
  test("detects initial offer threads with a creator reply pending", () => {
    const thread = createThread([
      createMessage(
        "message-1",
        "inbound",
        "We would love to partner on our Summer campaign. Are you interested in collaborating on one TikTok and one Instagram Reel?"
      ),
    ]);

    const brief = buildThreadBrief(thread, createAggregate());

    expect(brief.mode).toBe("initial_offer");
    expect(brief.nextMoveOwner).toBe("creator");
    expect(brief.latestInboundAsk).toContain("We would love to partner");
    expect(brief.brandName).toBe("BrightHome");
  });

  test("detects rate negotiation threads and preserves the current anchor", () => {
    const thread = createThread([
      createMessage(
        "message-1",
        "inbound",
        "Our budget is $1,500 for one TikTok and one Instagram Reel with 30 days paid social usage."
      ),
      createMessage(
        "message-2",
        "outbound",
        "Thanks for sharing. My rate is $2,500 for that scope, especially with paid social usage included."
      ),
    ]);

    const brief = buildThreadBrief(thread, createAggregate());

    expect(brief.mode).toBe("rate_negotiation");
    expect(brief.compensationType).toBe("guaranteed_paid");
    expect(brief.nextMoveOwner).toBe("brand");
    expect(brief.activeTerms.compensation).toBe("$1,500 - $2,500 range discussed");
  });

  test("flags affiliate or gifted outreach with exclusivity risk", () => {
    const thread = createThread([
      createMessage(
        "message-1",
        "inbound",
        "We would love to invite you to our affiliate program. This is a gifted collaboration with commission on sales plus a 30 day exclusivity window."
      ),
    ]);

    const brief = buildThreadBrief(thread, createAggregate());

    expect(brief.mode).toBe("decline_affiliate");
    expect(brief.compensationType).toBe("gifted");
    expect(brief.risks).toContain("Offer is product/gifted only, no cash compensation");
    expect(brief.risks).toContain("Exclusivity requested without guaranteed compensation");
  });

  test("downgrades generic repetitive follow-ups as low-signal", () => {
    const thread = createThread([
      createMessage("message-1", "inbound", "Following up on this."),
      createMessage("message-2", "inbound", "Following up on this."),
    ]);

    const brief = buildThreadBrief(thread, createAggregate());

    expect(brief.mode).toBe("low_signal_follow_up");
    expect(brief.nextMoveOwner).toBe("none");
    expect(brief.spamConfidence).toBe("high");
  });

  test("detects revision-cycle threads and keeps the brand as next owner after creator updates", () => {
    const thread = createThread([
      createMessage(
        "message-1",
        "inbound",
        "We have feedback below from content review. Please make the requested caption edits by Friday."
      ),
      createMessage(
        "message-2",
        "outbound",
        "Thanks, I sent the updated draft and made the requested caption changes."
      ),
    ]);

    const brief = buildThreadBrief(thread, createAggregate());

    expect(brief.mode).toBe("revision_cycle");
    expect(brief.nextMoveOwner).toBe("brand");
    expect(brief.activeTerms.deadlines).toContain("by Friday");
    expect(brief.lastCreatorPosition).toContain("Thanks");
  });

  test("detects go-live threads without reopening negotiation state", () => {
    const thread = createThread([
      createMessage(
        "message-1",
        "inbound",
        "Your video is approved and you can go live via the campaign link tomorrow. Please use the approved caption."
      ),
    ]);

    const brief = buildThreadBrief(thread, createAggregate());

    expect(brief.mode).toBe("go_live");
    expect(brief.nextMoveOwner).toBe("creator");
    expect(brief.activeTerms.deadlines).toContain("tomorrow");
    expect(brief.compensationType).toBe("unclear");
  });

  test("detects invoice closeout threads and preserves payment timing", () => {
    const thread = createThread([
      createMessage(
        "message-1",
        "inbound",
        "Please send your final invoice and W-9. Payment is processed within 30 days after receipt."
      ),
    ]);

    const brief = buildThreadBrief(thread, createAggregate());

    expect(brief.mode).toBe("invoice_closeout");
    expect(brief.nextMoveOwner).toBe("creator");
    expect(brief.activeTerms.paymentTiming).toBe("within 30 days");
    expect(brief.latestInboundAsk).toContain("Please send your final invoice");
  });
});
