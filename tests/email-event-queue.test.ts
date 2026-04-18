import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const inngestSendMock = vi.fn();
const runIncrementalEmailSyncMock = vi.fn();
const syncEmailAccountMock = vi.fn();

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
  },
}));

vi.mock("@/lib/email/providers/gmail", () => ({
  fetchGmailThreadsByIds: vi.fn(),
  getGoogleProfile: vi.fn(),
  listGmailHistoryThreadIds: vi.fn(),
  listRecentGmailThreads: vi.fn(),
  registerGmailWatch: vi.fn(),
}));

vi.mock("@/lib/email/providers/outlook", () => ({
  createOutlookSubscription: vi.fn(),
  fetchOutlookMessage: vi.fn(),
  fetchOutlookThreadsByConversationIds: vi.fn(),
  listRecentOutlookThreads: vi.fn(),
  renewOutlookSubscription: vi.fn(),
}));

vi.mock("@/lib/email/providers/yahoo", () => ({
  isYahooAppPasswordAccount: vi.fn(),
  listRecentYahooThreads: vi.fn(),
  listYahooThreadsSinceCursor: vi.fn(),
}));

vi.mock("@/lib/email/repository", () => ({
  acquireConnectedEmailAccountSyncLease: vi.fn(),
  getConnectedEmailAccount: vi.fn(),
  getEmailSyncState: vi.fn(),
  listAccountsNeedingRenewal: vi.fn(),
  listExistingEmailMessageProviderIdsForAccount: vi.fn(),
  updateConnectedEmailAccount: vi.fn(),
  upsertEmailSyncState: vi.fn(),
}));

vi.mock("@/lib/email/service-shared", () => ({
  compareHistoryIds: vi.fn(),
  EMAIL_INCREMENTAL_SYNC_BATCH_MAX_SIZE: 5,
  EMAIL_INCREMENTAL_SYNC_BATCH_WINDOW: "5s",
  ensureActiveEmailCredentials: vi.fn(),
  getEmailSyncState: vi.fn(),
  isGmailResyncRequiredError: vi.fn(),
  processLinkedThreadUpdates: vi.fn(),
  refreshEmailDealSuggestionsForViewer: vi.fn(),
  saveNonTransactionalSyncedThread: vi.fn(),
  YAHOO_POLL_INTERVAL_MS: 60000,
  clearEmailResyncRequiredNotification: vi.fn(),
  emitEmailResyncRequiredNotification: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getViewerById: vi.fn(),
}));

vi.mock("@/lib/server-debug", () => ({
  startServerDebug: vi.fn(() => ({
    complete: vi.fn(),
    fail: vi.fn(),
  })),
}));

describe("enqueueEmailEvent", () => {
  beforeEach(() => {
    inngestSendMock.mockReset();
    runIncrementalEmailSyncMock.mockReset();
    syncEmailAccountMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("throws in production when Inngest is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INNGEST_EVENT_KEY", "");

    const { enqueueEmailEvent } = await import("@/lib/email/service-sync");

    await expect(
      enqueueEmailEvent("email/account.initial_sync.requested", {
        accountId: "acct-1",
      })
    ).rejects.toThrow(
      "Inngest email processing is required but INNGEST_EVENT_KEY is not configured for email/account.initial_sync.requested."
    );

    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  test("keeps a local fallback in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INNGEST_EVENT_KEY", "");

    const service = await import("@/lib/email/service-sync");

    await expect(
      service.enqueueEmailEvent("email/account.initial_sync.requested", {
        accountId: "acct-1",
        recentLimit: 20,
      })
    ).resolves.toEqual({ mode: "local" });

    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  test("sends deterministic event IDs when Inngest is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INNGEST_EVENT_KEY", "test-key");

    const { enqueueEmailEvent } = await import("@/lib/email/service-sync");

    await expect(
      enqueueEmailEvent("email/account.incremental_sync.requested", {
        accountId: "acct-1",
        gmailHistoryId: "history-9",
        outlookMessageIds: ["msg-2", "msg-1"],
      })
    ).resolves.toEqual({ mode: "inngest" });

    expect(inngestSendMock).toHaveBeenCalledWith({
      id: "email/account.incremental_sync.requested:acct-1:history-9:msg-1,msg-2",
      name: "email/account.incremental_sync.requested",
      data: {
        accountId: "acct-1",
        gmailHistoryId: "history-9",
        outlookMessageIds: ["msg-2", "msg-1"],
      },
    });
  });
});
