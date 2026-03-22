import { describe, expect, test } from "vitest";

import {
  getActiveGuideStep,
  GUIDE_STEPS,
  type GuideContext
} from "@/lib/guide-registry";

function makeContext(overrides: Partial<GuideContext> = {}): GuideContext {
  return {
    pathname: "/app",
    hasActiveWorkspace: false,
    dismissedStepIds: new Set(),
    completedStepIds: new Set(),
    ...overrides
  };
}

describe("guide registry", () => {
  test("all guide steps have unique ids", () => {
    const ids = GUIDE_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all guide steps have non-empty title, body, and anchorSelector", () => {
    for (const step of GUIDE_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.anchorSelector.length).toBeGreaterThan(0);
    }
  });

  test("shows sidebar_new_workspace as first step on dashboard", () => {
    const ctx = makeContext({ pathname: "/app" });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).not.toBeNull();
    expect(step!.id).toBe("sidebar_new_workspace");
  });

  test("sidebar steps show in order on dashboard", () => {
    const ctx = makeContext({ pathname: "/app" });
    const sidebarIds = [
      "sidebar_new_workspace",
      "sidebar_inbox",
      "sidebar_payments",
      "sidebar_analytics",
      "sidebar_settings"
    ];

    let currentCtx = ctx;
    for (const expectedId of sidebarIds) {
      const step = getActiveGuideStep(GUIDE_STEPS, currentCtx);
      expect(step?.id).toBe(expectedId);
      currentCtx = {
        ...currentCtx,
        dismissedStepIds: new Set([...currentCtx.dismissedStepIds, expectedId])
      };
    }
  });

  test("add_first_documents shows after sidebar steps on /app routes", () => {
    const sidebarIds = [
      "sidebar_new_workspace",
      "sidebar_inbox",
      "sidebar_payments",
      "sidebar_analytics",
      "sidebar_settings"
    ];
    const ctx = makeContext({
      pathname: "/app/intake/new",
      dismissedStepIds: new Set(sidebarIds)
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("add_first_documents");
  });

  test("add_first_documents auto-completes when user has workspace", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: true,
      dismissedStepIds: new Set([
        "sidebar_new_workspace",
        "sidebar_inbox",
        "sidebar_payments",
        "sidebar_analytics",
        "sidebar_settings"
      ])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("assistant_intro");
  });

  test("assistant_intro shows on any /app route", () => {
    const dismissed = new Set(
      GUIDE_STEPS.filter((s) => s.id !== "assistant_intro").map((s) => s.id)
    );
    const ctx = makeContext({
      pathname: "/app/deals/abc-123",
      hasActiveWorkspace: true,
      dismissedStepIds: dismissed
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("assistant_intro");
  });

  test("skips dismissed steps", () => {
    const ctx = makeContext({
      pathname: "/app",
      dismissedStepIds: new Set(["sidebar_new_workspace"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("sidebar_inbox");
  });

  test("returns deal workspace step for deal routes after general steps dismissed", () => {
    const generalStepIds = GUIDE_STEPS
      .filter((s) => !s.id.startsWith("workspace_") && !s.id.endsWith("_tab_tip") && s.id !== "emails_tab_tip")
      .map((s) => s.id);
    const ctx = makeContext({
      pathname: "/app/deals/abc-123",
      hasActiveWorkspace: true,
      dismissedStepIds: new Set(generalStepIds)
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).not.toBeNull();
    expect(step!.id).toBe("workspace_tabs_intro");
  });

  test("returns null when all steps are dismissed", () => {
    const ctx = makeContext({
      pathname: "/app",
      dismissedStepIds: new Set(GUIDE_STEPS.map((s) => s.id))
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).toBeNull();
  });
});
