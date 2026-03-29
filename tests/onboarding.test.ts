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
    hasWorkspaceNotification: false,
    isMobile: false,
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

  test("welcome_start_here is the first step on dashboard for new users", () => {
    const ctx = makeContext({ pathname: "/app" });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).not.toBeNull();
    expect(step!.id).toBe("welcome_start_here");
  });

  test("welcome_start_here auto-completes when user has a workspace", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: true
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).not.toBe("welcome_start_here");
  });

  test("welcome_start_here auto-completes when a workspace notification exists", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasWorkspaceNotification: true
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("workspace_generating");
  });

  test("workspace_generating shows when notification exists", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasWorkspaceNotification: true,
      dismissedStepIds: new Set(["welcome_start_here"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("workspace_generating");
  });

  test("workspace_generating is skipped without notification", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasWorkspaceNotification: false,
      hasActiveWorkspace: true,
      dismissedStepIds: new Set(["welcome_start_here"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).not.toBe("workspace_generating");
  });

  test("workspace tour steps show in order on partnership page", () => {
    const workspaceIds = [
      "workspace_overview",
      "workspace_terms",
      "workspace_risks",
      "workspace_deliverables"
    ];

    let currentCtx = makeContext({
      pathname: "/app/p/abc-123",
      hasActiveWorkspace: true
    });

    for (const expectedId of workspaceIds) {
      const step = getActiveGuideStep(GUIDE_STEPS, currentCtx);
      expect(step?.id).toBe(expectedId);
      currentCtx = {
        ...currentCtx,
        dismissedStepIds: new Set([...currentCtx.dismissedStepIds, expectedId])
      };
    }
  });

  test("open_first_workspace shows on dashboard when user has workspaces but tour not done", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: true,
      dismissedStepIds: new Set(["welcome_start_here", "workspace_generating"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("open_first_workspace");
  });

  test("open_first_workspace does not show for users without workspaces", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: false,
      dismissedStepIds: new Set(["welcome_start_here"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).not.toBe("open_first_workspace");
  });

  test("assistant_intro is gated behind workspace tour", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: true,
      dismissedStepIds: new Set([
        "welcome_start_here",
        "workspace_generating",
        "open_first_workspace"
      ])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).not.toBe("assistant_intro");
  });

  test("assistant_intro shows once workspace tour steps are dismissed", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: true,
      dismissedStepIds: new Set([
        "welcome_start_here",
        "workspace_generating",
        "open_first_workspace",
        "workspace_overview",
        "workspace_terms",
        "workspace_risks",
        "workspace_deliverables"
      ])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("assistant_intro");
  });

  test("payments_intro shows on payments page", () => {
    const ctx = makeContext({
      pathname: "/app/payments",
      hasActiveWorkspace: true,
      dismissedStepIds: new Set(GUIDE_STEPS.filter((s) => s.id !== "payments_intro").map((s) => s.id))
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("payments_intro");
  });

  test("payments_intro does not show on other pages", () => {
    const ctx = makeContext({
      pathname: "/app",
      dismissedStepIds: new Set(
        GUIDE_STEPS.filter((s) => s.id !== "payments_intro").map((s) => s.id)
      )
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).toBeNull();
  });

  test("no steps show on non-matching routes like /app/inbox", () => {
    const ctx = makeContext({
      pathname: "/app/inbox",
      hasActiveWorkspace: false
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).toBeNull();
  });

  test("welcome_start_here does not match sub-routes like /app/intake/new", () => {
    const ctx = makeContext({
      pathname: "/app/intake/new",
      hasActiveWorkspace: false
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).toBeNull();
  });

  test("assistant_intro matches any /app sub-route after tour done", () => {
    const allDone = new Set(GUIDE_STEPS.filter((s) => s.id !== "assistant_intro" && s.id !== "payments_intro").map((s) => s.id));
    const ctx = makeContext({
      pathname: "/app/inbox",
      hasActiveWorkspace: true,
      dismissedStepIds: allDone
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).toBe("assistant_intro");
  });

  test("skips dismissed steps", () => {
    const ctx = makeContext({
      pathname: "/app",
      dismissedStepIds: new Set(["welcome_start_here"])
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step?.id).not.toBe("welcome_start_here");
  });

  test("returns null when all steps are dismissed", () => {
    const ctx = makeContext({
      pathname: "/app",
      hasActiveWorkspace: true,
      dismissedStepIds: new Set(GUIDE_STEPS.map((s) => s.id))
    });
    const step = getActiveGuideStep(GUIDE_STEPS, ctx);
    expect(step).toBeNull();
  });
});
