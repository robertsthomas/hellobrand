import { describe, expect, test } from "vitest";

import {
  buildAssistantSuggestedPrompts,
  getAssistantLocationLabel
} from "@/lib/assistant/suggested-prompts";
import type { AssistantClientContext } from "@/lib/types";

function buildContext(overrides?: Partial<AssistantClientContext>): AssistantClientContext {
  return {
    pathname: "/app/p/deal-123",
    pageTitle: "Partnership workspace",
    dealId: "deal-123",
    tab: null,
    profileLocation: null,
    trigger: null,
    tone: "professional",
    pageContext: null,
    ...overrides
  };
}

describe("assistant suggested prompts", () => {
  test("builds location-aware prompts when profile location is present", () => {
    const prompts = buildAssistantSuggestedPrompts(
      buildContext({ profileLocation: "Brooklyn, New York, USA" })
    );

    expect(prompts).toHaveLength(3);
    expect(prompts[0]?.prompt).toContain("based in Brooklyn, New York");
  });

  test("switches prompt set for payment-heavy contexts", () => {
    const prompts = buildAssistantSuggestedPrompts(
      buildContext({
        pathname: "/app/payments",
        pageTitle: "Payments",
        dealId: null,
        profileLocation: "Los Angeles, CA",
        tab: "invoices"
      })
    );

    expect(prompts.map((prompt) => prompt.label)).toContain("Invoice checklist");
    expect(prompts.map((prompt) => prompt.label)).toContain("Tax and payout flags");
  });

  test("falls back to generic prompts when location is missing", () => {
    const prompts = buildAssistantSuggestedPrompts(buildContext());

    expect(prompts.map((prompt) => prompt.label)).toEqual([
      "Contract risks",
      "Payment questions",
      "Draft a reply"
    ]);
  });

  test("condenses saved location labels for display", () => {
    expect(getAssistantLocationLabel("Chicago, Illinois, United States")).toBe(
      "Chicago, Illinois"
    );
  });
});
