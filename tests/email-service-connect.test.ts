import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "@/lib/types";

const {
  exchangeGoogleCodeMock,
  getGoogleProfileMock,
  verifyYahooMailboxAccessMock,
  saveConnectedEmailAccountMock,
  upsertEmailSyncStateMock,
  enqueueEmailEventMock,
  encryptSecretMock,
  parseOAuthStateMock,
  tokenExpiresAtMock,
  resolveEmailAppBaseUrlMock,
  assertEmailConnectionsAccessMock,
} = vi.hoisted(() => ({
  exchangeGoogleCodeMock: vi.fn(),
  getGoogleProfileMock: vi.fn(),
  verifyYahooMailboxAccessMock: vi.fn(),
  saveConnectedEmailAccountMock: vi.fn(),
  upsertEmailSyncStateMock: vi.fn(),
  enqueueEmailEventMock: vi.fn(),
  encryptSecretMock: vi.fn((value: string | null) => (value ? `enc:${value}` : null)),
  parseOAuthStateMock: vi.fn(),
  tokenExpiresAtMock: vi.fn(() => "2026-04-25T12:00:00.000Z"),
  resolveEmailAppBaseUrlMock: vi.fn(() => "https://mail.hellobrand.test"),
  assertEmailConnectionsAccessMock: vi.fn(),
}));

vi.mock("@/lib/email/providers/gmail", () => ({
  buildGoogleAuthUrl: vi.fn(),
  exchangeGoogleCode: exchangeGoogleCodeMock,
  getGoogleProfile: getGoogleProfileMock,
}));

vi.mock("@/lib/email/providers/outlook", () => ({
  buildOutlookAuthUrl: vi.fn(),
  exchangeOutlookCode: vi.fn(),
  getOutlookProfile: vi.fn(),
}));

vi.mock("@/lib/email/providers/yahoo", () => ({
  buildYahooAuthUrl: vi.fn(),
  exchangeYahooCode: vi.fn(),
  getYahooProfile: vi.fn(),
  verifyYahooMailboxAccess: verifyYahooMailboxAccessMock,
}));

vi.mock("@/lib/email/repository", () => ({
  findConnectedEmailAccountByProviderAddress: vi.fn(),
  findConnectedEmailAccountBySubscriptionId: vi.fn(),
  getEmailSyncState: vi.fn(),
  listExistingEmailMessageProviderIdsForAccount: vi.fn(),
  saveConnectedEmailAccount: saveConnectedEmailAccountMock,
  upsertEmailSyncState: upsertEmailSyncStateMock,
}));

vi.mock("@/lib/email/service-sync", () => ({
  enqueueEmailEvent: enqueueEmailEventMock,
}));

vi.mock("@/lib/email/crypto", () => ({
  encryptSecret: encryptSecretMock,
}));

vi.mock("@/lib/email/oauth-state", () => ({
  parseOAuthState: parseOAuthStateMock,
}));

vi.mock("@/lib/email/service-shared", () => ({
  assertEmailConnectionsAccess: assertEmailConnectionsAccessMock,
  compareHistoryIds: vi.fn(),
  isRecentIso: vi.fn(),
  OUTLOOK_WEBHOOK_DEDUPE_WINDOW_MS: 120000,
  redirectTarget: (
    pathname: string,
    searchParams?: Record<string, string | null | undefined>
  ) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value) params.set(key, value);
    }
    return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
  },
  tokenExpiresAt: tokenExpiresAtMock,
}));

vi.mock("@/lib/email/config", () => ({
  resolveEmailAppBaseUrl: resolveEmailAppBaseUrlMock,
  yahooScopes: ["openid", "profile", "email", "mail-r", "mail-w"],
  hasProviderConfig: vi.fn(() => true),
  isProviderEnabled: vi.fn(async () => true),
  isYahooOAuthEnabled: vi.fn(async () => true),
}));

import {
  connectYahooAppPasswordForViewer,
  handleGoogleCallbackForViewer,
} from "@/lib/email/service-connect";

const viewer: Viewer = {
  id: "user-1",
  email: "creator@example.com",
  displayName: "Creator",
  mode: "clerk",
};

describe("email service connect flows", () => {
  beforeEach(() => {
    exchangeGoogleCodeMock.mockReset();
    getGoogleProfileMock.mockReset();
    verifyYahooMailboxAccessMock.mockReset();
    saveConnectedEmailAccountMock.mockReset();
    upsertEmailSyncStateMock.mockReset();
    enqueueEmailEventMock.mockReset();
    encryptSecretMock.mockClear();
    parseOAuthStateMock.mockReset();
    tokenExpiresAtMock.mockClear();
    resolveEmailAppBaseUrlMock.mockClear();
    assertEmailConnectionsAccessMock.mockReset();
  });

  test("handles a Google OAuth callback and starts initial sync", async () => {
    parseOAuthStateMock.mockReturnValue({
      userId: "user-1",
      provider: "gmail",
      returnBaseUrl: "https://workspace.hellobrand.test",
    });
    exchangeGoogleCodeMock.mockResolvedValue({
      access_token: "google-access",
      refresh_token: "google-refresh",
      scope: "email profile https://www.googleapis.com/auth/gmail.readonly",
      expires_in: 3600,
    });
    getGoogleProfileMock.mockResolvedValue({
      providerAccountId: "google-account-1",
      emailAddress: "creator@gmail.com",
      displayName: "Creator Gmail",
      historyId: "42",
    });
    saveConnectedEmailAccountMock.mockResolvedValue({ id: "account-1" });

    const redirect = await handleGoogleCallbackForViewer(viewer, {
      code: "google-code",
      state: "signed-google-state",
    });

    expect(exchangeGoogleCodeMock).toHaveBeenCalledWith("google-code");
    expect(getGoogleProfileMock).toHaveBeenCalledWith("google-access");
    expect(saveConnectedEmailAccountMock).toHaveBeenCalledWith({
      userId: "user-1",
      provider: "gmail",
      providerAccountId: "google-account-1",
      emailAddress: "creator@gmail.com",
      displayName: "Creator Gmail",
      scopes: ["email", "profile", "https://www.googleapis.com/auth/gmail.readonly"],
      accessTokenEncrypted: "enc:google-access",
      refreshTokenEncrypted: "enc:google-refresh",
      tokenExpiresAt: "2026-04-25T12:00:00.000Z",
      status: "connected",
    });
    expect(upsertEmailSyncStateMock).toHaveBeenCalledWith("account-1", {
      lastHistoryId: "42",
    });
    expect(enqueueEmailEventMock).toHaveBeenCalledWith("email/account.initial_sync.requested", {
      accountId: "account-1",
    });
    expect(redirect).toBe(
      "https://mail.hellobrand.test/app/settings?email_status=connected&email_provider=gmail"
    );
  });

  test("connects a Yahoo app password account and queues sync", async () => {
    saveConnectedEmailAccountMock.mockResolvedValue({ id: "account-yahoo-1" });

    const account = await connectYahooAppPasswordForViewer(viewer, {
      emailAddress: " Creator@Yahoo.com ",
      appPassword: "  yahoo-app-password  ",
    });

    expect(assertEmailConnectionsAccessMock).toHaveBeenCalledWith(viewer);
    expect(verifyYahooMailboxAccessMock).toHaveBeenCalledWith(
      " Creator@Yahoo.com ",
      "yahoo-app-password",
      true
    );
    expect(saveConnectedEmailAccountMock).toHaveBeenCalledWith({
      userId: "user-1",
      provider: "yahoo",
      providerAccountId: "creator@yahoo.com",
      emailAddress: "creator@yahoo.com",
      displayName: " Creator",
      scopes: ["app_password"],
      accessTokenEncrypted: null,
      refreshTokenEncrypted: "enc:yahoo-app-password",
      tokenExpiresAt: null,
      status: "syncing",
    });
    expect(upsertEmailSyncStateMock).toHaveBeenCalledWith("account-yahoo-1", {
      providerCursor: null,
      providerSubscriptionId: null,
      subscriptionExpiresAt: expect.any(String),
      lastHistoryId: null,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    expect(enqueueEmailEventMock).toHaveBeenCalledWith("email/account.initial_sync.requested", {
      accountId: "account-yahoo-1",
      recentLimit: 100,
    });
    expect(account).toEqual({ id: "account-yahoo-1" });
  });
});
