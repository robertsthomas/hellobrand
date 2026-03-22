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

  test("returns first matching step for /app route", () => {
    const ctx = makeContext({ pathname: "/app" });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).not.toBeNull();
    expect(step!.id).toBe("create_workspace");
  });

  test("auto-completes create_workspace when user has active workspace", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: true
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    // create_workspace should be skipped
    expect(step?.id).not.toBe("create_workspace");
  });

  test("skips dismissed steps", () => {
    const ctx = makeContext({
      pathname: "/app",
      dismissedStepIds: new Set(["create_workspace"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).not.toBe("create_workspace");
  });

  test("skips completed steps", () => {
    const ctx = makeContext({
      pathname: "/app",
      completedStepIds: new Set(["create_workspace"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).not.toBe("create_workspace");
  });

  test("returns deal workspace step for deal routes", () => {
    const ctx = makeContext({
      pathname: "/app/deals/abc-123",
      hasActiveWorkspace: true
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

  test("sidebar steps match /app route", () => {
    const sidebarSteps = GUIDE_STEPS.filter((s) =>
      s.id.startsWith("sidebar_")
    );
    const ctx = makeContext({
      pathname: "/app",
      dismissedStepIds: new Set(["create_workspace"])
    });

    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(sidebarSteps.some((s) => s.id === step?.id)).toBe(true);
  });
});
