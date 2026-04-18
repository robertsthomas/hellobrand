import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  sanitizeInngestUrlEnv,
  shouldIgnoreInngestUrlOverride,
} from "@/lib/inngest/env";

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe("shouldIgnoreInngestUrlOverride", () => {
  it("ignores localhost-style URLs in production", () => {
    expect(shouldIgnoreInngestUrlOverride("http://127.0.0.1:8288", "production")).toBe(true);
    expect(shouldIgnoreInngestUrlOverride("http://localhost:8288", "production")).toBe(true);
  });

  it("does not ignore cloud URLs in production", () => {
    expect(shouldIgnoreInngestUrlOverride("https://api.inngest.com", "production")).toBe(false);
    expect(shouldIgnoreInngestUrlOverride("https://inn.gs", "production")).toBe(false);
  });

  it("does not ignore localhost-style URLs outside production", () => {
    expect(shouldIgnoreInngestUrlOverride("http://127.0.0.1:8288", "development")).toBe(false);
  });
});

describe("sanitizeInngestUrlEnv", () => {
  it("removes localhost-style Inngest URL overrides in production", () => {
    const env = {
      INNGEST_BASE_URL: "http://127.0.0.1:8288",
      INNGEST_API_BASE_URL: "http://localhost:8288",
      INNGEST_EVENT_API_BASE_URL: "http://0.0.0.0:8288",
      INNGEST_DEVSERVER_URL: "http://foo.localhost:8288",
      INNGEST_EVENT_KEY: "event-key",
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    sanitizeInngestUrlEnv(env, "production");

    expect(env.INNGEST_BASE_URL).toBeUndefined();
    expect(env.INNGEST_API_BASE_URL).toBeUndefined();
    expect(env.INNGEST_EVENT_API_BASE_URL).toBeUndefined();
    expect(env.INNGEST_DEVSERVER_URL).toBeUndefined();
    expect(env.INNGEST_EVENT_KEY).toBe("event-key");
    expect(warnSpy).toHaveBeenCalledTimes(4);
  });

  it("preserves explicit non-local overrides in production", () => {
    const env = {
      INNGEST_BASE_URL: "https://api.inngest.com",
      INNGEST_API_BASE_URL: "https://api.inngest.com",
      INNGEST_EVENT_API_BASE_URL: "https://inn.gs",
      INNGEST_DEVSERVER_URL: "https://example.com/devserver",
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    sanitizeInngestUrlEnv(env, "production");

    expect(env.INNGEST_BASE_URL).toBe("https://api.inngest.com");
    expect(env.INNGEST_API_BASE_URL).toBe("https://api.inngest.com");
    expect(env.INNGEST_EVENT_API_BASE_URL).toBe("https://inn.gs");
    expect(env.INNGEST_DEVSERVER_URL).toBe("https://example.com/devserver");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
