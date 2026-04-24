import { describe, expect, test } from "vitest";

import {
  detectImportantEmailEvents,
  isLikelyBrandDealEmail,
  scoreThreadAgainstDeal,
} from "@/lib/email/smart-inbox";
import type {
  DealAggregate,
  EmailAttachmentRecord,
  EmailMessageRecord,
  EmailThreadListItem,
} from "@/lib/types";

function createAttachment(overrides: Partial<EmailAttachmentRecord> = {}): EmailAttachmentRecord {
  return {
    id: "attachment-1",
    messageId: "message-1",
    providerAttachmentId: "provider-attachment-1",
    filename: "agreement.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    storageKey: null,
    extractedText: null,
    createdAt: "2026-03-25T00:00:00.000Z",
    ...overrides
  };
}

function createMessage(overrides: Partial<EmailMessageRecord> = {}): EmailMessageRecord {
  return {
    id: "message-1",
    threadId: "thread-1",
    providerMessageId: "provider-message-1",
    internetMessageId: null,
    from: {
      name: "Agency",
      email: "team@example.com"
    },
    to: [
      {
        name: "Thomas",
        email: "thomas@example.com"
      }
    ],
    cc: [],
    bcc: [],
    subject: "Oreo Cakesters BTS campaign",
    textBody:
      "Dear Thomas, On behalf of TikTal OU, we are thrilled to officially invite you to collaborate with us and our client, Mondelez, for an upcoming Oreo Cakesters BTS campaign.",
    htmlBody: null,
    sentAt: "2026-03-25T00:00:00.000Z",
    receivedAt: "2026-03-25T00:00:00.000Z",
    direction: "inbound",
    hasAttachments: false,
    rawStorageKey: null,
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
    attachments: [],
    ...overrides
  };
}

type ThreadListItemOverrides = Partial<Omit<EmailThreadListItem, "thread" | "account">> & {
  thread?: Partial<EmailThreadListItem["thread"]>;
  account?: Partial<EmailThreadListItem["account"]>;
};

function createThreadListItem(overrides: ThreadListItemOverrides = {}): EmailThreadListItem {
  const threadOverrides = overrides.thread ?? {};
  const accountOverrides = overrides.account ?? {};
  const baseThread: EmailThreadListItem["thread"] = {
    id: "thread-1",
    accountId: "account-1",
    provider: "gmail",
    providerThreadId: "provider-thread-1",
    subject: "Paid Partnership Opportunity",
    snippet: "We'd love to partner on a campaign.",
    participants: [
      {
        name: "Brand Team",
        email: "partnerships@example.com",
      },
    ],
    lastMessageAt: "2026-04-18T12:00:00.000Z",
    messageCount: 1,
    isContractRelated: false,
    aiSummary: null,
    aiSummaryUpdatedAt: null,
    workflowState: "unlinked",
    draftUpdatedAt: null,
    createdAt: "2026-04-18T12:00:00.000Z",
    updatedAt: "2026-04-18T12:00:00.000Z",
  };
  const baseAccount: EmailThreadListItem["account"] = {
    id: "account-1",
    userId: "user-1",
    provider: "gmail",
    providerAccountId: "provider-account-1",
    emailAddress: "thomas@example.com",
    displayName: "Thomas",
    status: "connected",
    scopes: [],
    accessTokenEncrypted: null,
    refreshTokenEncrypted: null,
    mailAuthConfigured: false,
    tokenExpiresAt: null,
    lastSyncAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: "2026-04-18T12:00:00.000Z",
    updatedAt: "2026-04-18T12:00:00.000Z",
  };

  return {
    thread: { ...baseThread, ...threadOverrides },
    account: { ...baseAccount, ...accountOverrides },
    links: [],
    primaryLink: null,
    referenceLinks: [],
    importantEventCount: 0,
    latestImportantEventAt: null,
    pendingTermSuggestionCount: 0,
    pendingActionItemCount: 0,
    latestPendingActionItemAt: null,
    savedDraft: null,
    noteCount: 0,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => key !== "thread" && key !== "account")
    ),
  };
}

function createDealAggregate(overrides: Partial<DealAggregate> = {}): DealAggregate {
  return {
    deal: {
      id: "deal-1",
      userId: "user-1",
      brandName: "BrightHome",
      campaignName: "Holiday Campaign",
      status: "negotiating",
      paymentStatus: "awaiting_payment",
      countersignStatus: "pending",
      summary: null,
      legalDisclaimer: "",
      nextDeliverableDate: null,
      createdAt: "2026-04-18T12:00:00.000Z",
      updatedAt: "2026-04-18T12:00:00.000Z",
      analyzedAt: null,
      confirmedAt: null,
      statusBeforeArchive: null,
    },
    latestDocument: null,
    documents: [],
    terms: {
      id: "terms-1",
      dealId: "deal-1",
      brandName: "BrightHome",
      agencyName: "Target Agency",
      creatorName: null,
      campaignName: "Holiday Campaign",
      paymentAmount: null,
      currency: null,
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
      createdAt: "2026-04-18T12:00:00.000Z",
      updatedAt: "2026-04-18T12:00:00.000Z",
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

describe("smart inbox event detection", () => {
  test("does not classify attachment OCR as message-level inbox updates", () => {
    const message = createMessage({
      hasAttachments: true,
      attachments: [
        createAttachment({
          filename: "OREO Cakesters _ @therobertscasa Agreement.pdf",
          extractedText:
            "Please review and sign. Payment will be net 30 after approval. Usage rights are organic and paid social for 6 months. Draft deliverables due Friday."
        })
      ]
    });

    const events = detectImportantEmailEvents(message);

    expect(events.map((event) => event.category)).toEqual(["attachment"]);
    expect(events[0]).toMatchObject({
      title: "New attachment added to linked thread"
    });
  });

  test("keeps directly stated message updates", () => {
    const message = createMessage({
      textBody:
        "Please confirm you can send the draft by Friday. Payment is net 30 after approval.",
      hasAttachments: true,
      attachments: [createAttachment()]
    });

    const events = detectImportantEmailEvents(message);

    expect(events.map((event) => event.category)).toEqual([
      "payment",
      "timeline",
      "deliverable",
      "approval",
      "ask",
      "attachment"
    ]);
  });
});

describe("isLikelyBrandDealEmail", () => {
  test("matches campaign collaboration outreach like the inbox find flow expects", () => {
    const item = createThreadListItem({
      thread: {
        subject: "Holiday Campaign Collaboration - BrightHome x Target",
        snippet:
          "Hi Thomas, I hope this message finds you well. I'm reaching out on behalf of BrightHome about a holiday campaign.",
      },
    });

    expect(isLikelyBrandDealEmail(item)).toBe(true);
  });

  test("matches short collab pitch subjects that rely on creator outreach language", () => {
    const item = createThreadListItem({
      thread: {
        subject: "Quick collab idea 👀",
        snippet:
          "Hey Thomas, Came across your content and think you'd be perfect for something we're testing.",
      },
    });

    expect(isLikelyBrandDealEmail(item)).toBe(true);
  });
});

describe("scoreThreadAgainstDeal", () => {
  test("returns a strong match when brand and campaign signals align", () => {
    const thread = createThreadListItem({
      thread: {
        subject: "Holiday Campaign Collaboration - BrightHome x Target",
        snippet:
          "Hi Thomas, Target Agency wants to confirm BrightHome deliverables and campaign timing.",
        isContractRelated: true,
      },
      links: [],
    });

    const result = scoreThreadAgainstDeal(thread, createDealAggregate());

    expect(result).not.toBeNull();
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result?.reasons.join(" ")).toContain("Campaign name matched");
    expect(result?.evidence).toMatchObject({
      exactMatches: expect.arrayContaining(["Holiday Campaign", "BrightHome", "Target Agency"]),
    });
  });

  test("returns null when a thread has no meaningful partnership overlap", () => {
    const thread = createThreadListItem({
      thread: {
        subject: "Dinner reservation confirmation",
        snippet: "Your table for two is booked for Friday night.",
        participants: [{ name: "Restaurant", email: "host@bistro.com" }],
        isContractRelated: false,
      },
    });

    const result = scoreThreadAgainstDeal(thread, createDealAggregate());

    expect(result).toBeNull();
  });
});
