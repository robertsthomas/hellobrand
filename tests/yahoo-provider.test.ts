import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { buildYahooAuthUrl, buildYahooProviderCursor, parseYahooProviderCursor } from "@/lib/email/providers/yahoo";

const originalYahooClientId = process.env.YAHOO_CLIENT_ID;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalIntegrationsAppUrl = process.env.INTEGRATIONS_APP_URL;

beforeEach(() => {
  process.env.YAHOO_CLIENT_ID = "yahoo-client-id";
  process.env.NEXT_PUBLIC_APP_URL = "https://hellobrand.app";
  delete process.env.INTEGRATIONS_APP_URL;
});

afterEach(() => {
  if (originalYahooClientId === undefined) {
    delete process.env.YAHOO_CLIENT_ID;
  } else {
    process.env.YAHOO_CLIENT_ID = originalYahooClientId;
  }

  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }

  if (originalIntegrationsAppUrl === undefined) {
    delete process.env.INTEGRATIONS_APP_URL;
  } else {
    process.env.INTEGRATIONS_APP_URL = originalIntegrationsAppUrl;
  }
});

describe("Yahoo provider cursor helpers", () => {
  test("builds Yahoo auth URLs with OAuth mail scopes", () => {
    const url = new URL(buildYahooAuthUrl("signed-state", "nonce-123"));

    expect(url.origin + url.pathname).toBe("https://api.login.yahoo.com/oauth2/request_auth");
    expect(url.searchParams.get("client_id")).toBe("yahoo-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://hellobrand.app/api/email/yahoo/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("nonce")).toBe("nonce-123");
    expect(url.searchParams.get("scope")).toBe("openid profile email mail-r mail-w");
  });

  test("round-trips uid and uidValidity", () => {
    const cursor = buildYahooProviderCursor(4821, "123456");

    expect(parseYahooProviderCursor(cursor)).toEqual({
      lastUid: 4821,
      uidValidity: "123456"
    });
  });

  test("returns null for malformed cursor data", () => {
    expect(parseYahooProviderCursor("not-json")).toBeNull();
    expect(parseYahooProviderCursor(JSON.stringify({ lastUid: "bad" }))).toBeNull();
  });
});
