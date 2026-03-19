import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/email/crypto";
import { createOAuthState, parseOAuthState } from "@/lib/email/oauth-state";

const originalKey = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.EMAIL_TOKEN_ENCRYPTION_KEY = "test-email-key";
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  } else {
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = originalKey;
  }
});

describe("email token crypto", () => {
  test("round-trips encrypted secrets", () => {
    const encrypted = encryptSecret("refresh-token-123");

    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("refresh-token-123");
    expect(decryptSecret(encrypted)).toBe("refresh-token-123");
  });

  test("returns null for missing values", () => {
    expect(encryptSecret(null)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });
});

describe("email oauth state", () => {
  test("creates and parses signed state payloads", () => {
    const state = createOAuthState("user-123", "gmail");
    const parsed = parseOAuthState(state);

    expect(parsed.userId).toBe("user-123");
    expect(parsed.provider).toBe("gmail");
    expect(parsed.nonce).toBeTruthy();
  });

  test("rejects tampered state", () => {
    const state = createOAuthState("user-123", "outlook");
    const tampered = `${state}broken`;

    expect(() => parseOAuthState(tampered)).toThrow();
  });
});
