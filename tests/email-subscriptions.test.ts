import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildEmailSubscriptionHeaders,
  createEmailSubscriptionToken,
  formatEmailSubscriptionCategory,
  parseEmailSubscriptionToken
} from "@/lib/email-subscriptions";

describe("email subscriptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips product update unsubscribe tokens", () => {
    vi.stubEnv("EMAIL_TOKEN_ENCRYPTION_KEY", "test-secret");

    const token = createEmailSubscriptionToken({
      email: "Creator@Example.com ",
      category: "product_updates"
    });

    expect(parseEmailSubscriptionToken(token)).toEqual({
      email: "creator@example.com",
      category: "product_updates"
    });
  });

  it("rejects tampered unsubscribe tokens", () => {
    vi.stubEnv("EMAIL_TOKEN_ENCRYPTION_KEY", "test-secret");

    const token = createEmailSubscriptionToken({
      email: "creator@example.com",
      category: "product_updates"
    });

    expect(parseEmailSubscriptionToken(`${token}tampered`)).toBeNull();
  });

  it("builds one-click unsubscribe headers", () => {
    vi.stubEnv("EMAIL_TOKEN_ENCRYPTION_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.hellobrand.com");

    const result = buildEmailSubscriptionHeaders({
      email: "creator@example.com",
      category: "product_updates"
    });

    expect(result.unsubscribeUrl).toMatch(
      /^https:\/\/app\.hellobrand\.com\/api\/email\/unsubscribe\?token=/
    );
    expect(result.headers["List-Unsubscribe"]).toBe(
      `<${result.unsubscribeUrl}>`
    );
    expect(result.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
  });

  it("formats category labels for UI copy", () => {
    expect(formatEmailSubscriptionCategory("product_updates")).toBe(
      "product updates"
    );
  });
});
