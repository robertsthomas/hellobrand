import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { aggregateMock, countMock } = vi.hoisted(() => ({
  aggregateMock: vi.fn(),
  countMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiUsageEvent: {
      aggregate: aggregateMock,
      count: countMock,
      create: vi.fn()
    },
    aiCacheEntry: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

import { prepareAiStreamExecution } from "@/lib/ai/gateway";

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_MODEL_RISKS: process.env.OPENROUTER_MODEL_RISKS,
  AI_PREMIUM_SOFT_CAP_USD: process.env.AI_PREMIUM_SOFT_CAP_USD,
  AI_PREMIUM_HARD_CAP_USD: process.env.AI_PREMIUM_HARD_CAP_USD
};

const testEnv = process.env as Record<string, string | undefined>;

describe("ai gateway", () => {
  beforeEach(() => {
    aggregateMock.mockReset();
    countMock.mockReset();
    delete testEnv.DATABASE_URL;
    testEnv.NODE_ENV = "test";
    delete testEnv.OPENROUTER_MODEL;
    delete testEnv.OPENROUTER_MODEL_RISKS;
    testEnv.AI_PREMIUM_SOFT_CAP_USD = "20";
    testEnv.AI_PREMIUM_HARD_CAP_USD = "30";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete testEnv[key];
      } else {
        testEnv[key] = value;
      }
    }
  });

  it("uses low-cost non-Anthropic defaults for assistant chat", async () => {
    const prepared = await prepareAiStreamExecution({
      taskKey: "assistant_chat",
      featureKey: "assistant_chat"
    });

    expect(prepared.requestedModel).toBe("openai/gpt-5-mini");
    expect(prepared.fallbacks).toEqual(["google/gemini-2.5-flash"]);
    expect(prepared.budgetDecision).toBe("normal");
  });

  it("ignores anthropic env overrides in production", async () => {
    testEnv.NODE_ENV = "production";
    testEnv.OPENROUTER_MODEL_RISKS = "anthropic/claude-sonnet-4.5";

    const prepared = await prepareAiStreamExecution({
      taskKey: "analyze_risks",
      featureKey: "document_analysis"
    });

    expect(prepared.requestedModel).toBe("google/gemini-3-flash-preview");
    expect(prepared.fallbacks).toEqual(["openai/gpt-5-mini"]);
  });

  it("degrades to the cheapest route after the soft cap", async () => {
    testEnv.DATABASE_URL = "postgres://example";
    aggregateMock
      .mockResolvedValueOnce({ _sum: { estimatedCostUsd: 0 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUsd: 0 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUsd: 21 } })
      .mockResolvedValueOnce({ _sum: { totalTokens: 0 } });
    countMock.mockResolvedValue(0);

    const prepared = await prepareAiStreamExecution({
      userId: "user-1",
      taskKey: "email_draft",
      featureKey: "premium_inbox"
    });

    expect(prepared.budgetDecision).toBe("degraded");
    expect(prepared.requestedModel).toBe("google/gemini-2.5-flash");
    expect(prepared.fallbacks).toEqual([]);
    expect(prepared.maxTokens).toBe(Math.max(120, Math.floor(4096 * 0.7)));
  });

  it("uses the fast Gemini route for email drafts", async () => {
    const prepared = await prepareAiStreamExecution({
      taskKey: "email_draft",
      featureKey: "premium_inbox"
    });

    expect(prepared.requestedModel).toBe("google/gemini-2.5-flash");
    expect(prepared.fallbacks).toEqual(["openai/gpt-5.4-mini", "google/gemini-3-flash-preview"]);
    expect(prepared.maxTokens).toBe(4096);
    expect(prepared.budgetDecision).toBe("normal");
  });

  it("lets the global model override the email draft route", async () => {
    testEnv.OPENROUTER_MODEL = "openai/gpt-5-mini";

    const prepared = await prepareAiStreamExecution({
      taskKey: "email_draft",
      featureKey: "premium_inbox"
    });

    expect(prepared.requestedModel).toBe("openai/gpt-5-mini");
  });

  it("blocks requests above the hard cap", async () => {
    testEnv.DATABASE_URL = "postgres://example";
    aggregateMock
      .mockResolvedValueOnce({ _sum: { estimatedCostUsd: 0 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUsd: 0 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUsd: 31 } })
      .mockResolvedValueOnce({ _sum: { totalTokens: 0 } });
    countMock.mockResolvedValue(0);

    const prepared = await prepareAiStreamExecution({
      userId: "user-1",
      taskKey: "assistant_chat",
      featureKey: "assistant_chat"
    });

    expect(prepared.budgetDecision).toBe("blocked");
    expect(prepared.fallbacks).toEqual([]);
  });
});
