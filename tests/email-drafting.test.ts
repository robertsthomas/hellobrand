import { beforeEach, describe, expect, test, vi } from "vitest";

const { runStructuredOpenRouterTaskMock } = vi.hoisted(() => ({
  runStructuredOpenRouterTaskMock: vi.fn(),
}));

vi.mock("@/lib/ai/structured", () => ({
  runStructuredOpenRouterTask: runStructuredOpenRouterTaskMock,
}));

import { generateEmailReplyDraft } from "@/lib/email/ai";
import type { EmailThreadDetail, ProfileRecord } from "@/lib/types";

function buildThread(overrides?: Partial<EmailThreadDetail>): EmailThreadDetail {
  return {
    thread: {
      id: "thread-1",
      accountId: "account-1",
      provider: "gmail",
      providerThreadId: "provider-thread-1",
      subject: "Usage terms and timeline",
      snippet: "Can you confirm the revised deadline?",
      participants: [{ name: "Jamie", email: "jamie@brand.com" }],
      lastMessageAt: "2026-04-20T12:00:00.000Z",
      messageCount: 1,
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
    messages: [
      {
        id: "message-1",
        threadId: "thread-1",
        providerMessageId: "provider-message-1",
        internetMessageId: null,
        from: {
          name: "Jamie",
          email: "jamie@brand.com",
        },
        to: [{ name: "Creator", email: "creator@example.com" }],
        cc: [],
        bcc: [],
        subject: "Usage terms and timeline",
        textBody:
          "Can you confirm whether the revised usage language works for you and whether you can send the draft by Friday?",
        htmlBody: null,
        sentAt: "2026-04-20T12:00:00.000Z",
        receivedAt: "2026-04-20T12:00:00.000Z",
        direction: "inbound",
        hasAttachments: false,
        rawStorageKey: null,
        createdAt: "2026-04-20T12:00:00.000Z",
        updatedAt: "2026-04-20T12:00:00.000Z",
        attachments: [],
      },
    ],
    links: [],
    primaryLink: null,
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

function buildProfile(overrides?: Partial<ProfileRecord>): ProfileRecord {
  return {
    id: "profile-1",
    userId: "user-1",
    displayName: "Creator Name",
    creatorLegalName: null,
    businessName: null,
    contactEmail: "creator@example.com",
    timeZone: null,
    preferredSignature: "Creator Name",
    payoutDetails: null,
    defaultCurrency: null,
    reminderLeadDays: null,
    conflictAlertsEnabled: true,
    paymentRemindersEnabled: true,
    emailNotificationsEnabled: true,
    accentColor: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("email drafting", () => {
  beforeEach(() => {
    runStructuredOpenRouterTaskMock.mockReset();
  });

  test("normalizes structured AI output before returning the draft", async () => {
    runStructuredOpenRouterTaskMock.mockResolvedValue({
      data: {
        subject: "**Re: Updated usage terms**",
        body: "Hi [Brand Name] — Thanks for the update.\n- I can confirm Friday works.",
      },
    });

    const draft = await generateEmailReplyDraft(buildThread(), null, buildProfile());

    expect(runStructuredOpenRouterTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          featureKey: "premium_inbox",
          taskKey: "email_draft",
        },
      })
    );
    expect(draft).toEqual({
      subject: "Re: Updated usage terms",
      body: "Hi there, Thanks for the update.\nI can confirm Friday works.",
    });
  });

  test("falls back to a deterministic creator-professional draft when the model has no result", async () => {
    runStructuredOpenRouterTaskMock.mockResolvedValue(null);

    const draft = await generateEmailReplyDraft(buildThread(), null, buildProfile());

    expect(draft.subject).toBe("Re: Usage terms and timeline");
    expect(draft.body).toContain("Thanks for following up.");
    expect(draft.body).toContain("I am still reviewing the details");
    expect(draft.body).toContain("Best,\nCreator Name");
  });
});
