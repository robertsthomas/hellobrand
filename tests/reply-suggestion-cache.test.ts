import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailThreadDetail, Viewer } from "@/lib/types";

const { generateReplySuggestionsMock } = vi.hoisted(() => ({
  generateReplySuggestionsMock: vi.fn()
}));

vi.mock("@/lib/email/ai", () => ({
  generateReplySuggestions: generateReplySuggestionsMock
}));

import { getPersistedReplySuggestionsForThread } from "@/lib/email/reply-suggestion-cache";

function buildThreadDetail(overrides?: Partial<EmailThreadDetail["thread"]>) {
  return {
    thread: {
      id: "thread-1",
      accountId: "account-1",
      provider: "gmail",
      providerThreadId: "provider-thread-1",
      subject: "Re: Spring launch",
      snippet: "Can you share more detail?",
      participants: [],
      lastMessageAt: "2026-03-24T12:00:00.000Z",
      messageCount: 4,
      isContractRelated: true,
      aiSummary: null,
      aiSummaryUpdatedAt: null,
      createdAt: "2026-03-24T10:00:00.000Z",
      updatedAt: "2026-03-24T12:00:00.000Z",
      ...overrides
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
      tokenExpiresAt: null,
      lastSyncAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: "2026-03-24T10:00:00.000Z",
      updatedAt: "2026-03-24T10:00:00.000Z"
    },
    messages: [],
    links: [],
    importantEvents: [],
    termSuggestions: [],
    actionItems: [],
    promiseDiscrepancies: [],
    crossDealConflicts: []
  } as unknown as EmailThreadDetail;
}

const viewer: Viewer = {
  id: "user-1",
  email: "creator@example.com",
  displayName: "Creator",
  mode: "demo"
};

describe("reply suggestion cache adapter", () => {
  beforeEach(() => {
    generateReplySuggestionsMock.mockReset();
  });

  it("delegates to the AI suggestion generator", async () => {
    const generated = [
      {
        id: "ai-0",
        label: "Confirm next steps",
        prompt: "Confirm the next steps and ask for timeline details."
      }
    ];
    const thread = buildThreadDetail();
    generateReplySuggestionsMock.mockResolvedValue(generated);

    const result = await getPersistedReplySuggestionsForThread(viewer, thread);

    expect(result).toEqual(generated);
    expect(generateReplySuggestionsMock).toHaveBeenCalledWith(thread);
  });
});
