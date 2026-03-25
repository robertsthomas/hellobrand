import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailThreadDetail, Viewer } from "@/lib/types";

const {
  findUniqueMock,
  upsertMock,
  deleteManyMock,
  generateReplySuggestionsMock
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
  deleteManyMock: vi.fn(),
  generateReplySuggestionsMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailThreadReplySuggestionCache: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
      deleteMany: deleteManyMock
    }
  }
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

describe("reply suggestion cache", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    deleteManyMock.mockReset();
    generateReplySuggestionsMock.mockReset();
    process.env.DATABASE_URL = "postgres://example";
  });

  it("returns persisted suggestions for the current thread version", async () => {
    const persisted = [
      {
        id: "cached-1",
        label: "Ask for more detail",
        prompt: "Ask the brand to clarify the deliverables."
      }
    ];
    findUniqueMock.mockResolvedValue({
      suggestionsJson: persisted
    });

    const result = await getPersistedReplySuggestionsForThread(viewer, buildThreadDetail());

    expect(result).toEqual(persisted);
    expect(generateReplySuggestionsMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("generates and persists new suggestions when no current version is cached", async () => {
    const generated = [
      {
        id: "ai-0",
        label: "Confirm next steps",
        prompt: "Confirm the next steps and ask for timeline details."
      }
    ];
    findUniqueMock.mockResolvedValue(null);
    generateReplySuggestionsMock.mockResolvedValue(generated);

    const thread = buildThreadDetail({
      updatedAt: "2026-03-24T13:00:00.000Z",
      lastMessageAt: "2026-03-24T13:00:00.000Z",
      messageCount: 5
    });

    const result = await getPersistedReplySuggestionsForThread(viewer, thread);

    expect(result).toEqual(generated);
    expect(generateReplySuggestionsMock).toHaveBeenCalledWith(thread);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_threadId_threadVersion: {
            userId: "user-1",
            threadId: "thread-1",
            threadVersion: "2026-03-24T13:00:00.000Z:2026-03-24T13:00:00.000Z:5"
          }
        }
      })
    );
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        threadId: "thread-1",
        threadVersion: {
          not: "2026-03-24T13:00:00.000Z:2026-03-24T13:00:00.000Z:5"
        }
      }
    });
  });
});
