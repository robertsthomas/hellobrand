import { describe, expect, test } from "vitest";

import { getActiveGuideStep, GUIDE_STEPS, type GuideContext } from "@/lib/guide-registry";

function buildGuideContext(
  overrides: Partial<GuideContext> = {}
): GuideContext {
  return {
    pathname: "/app",
    hasActiveWorkspace: false,
    hasWorkspaceNotification: false,
    hasEverCreatedWorkspace: false,
    isMobile: false,
    dismissedStepIds: new Set<string>(),
    completedStepIds: new Set<string>(),
    ...overrides
  };
}

describe("guide registry", () => {
  test("shows the workspace-generating notification tooltip for first-time workspace creation", () => {
    const step = getActiveGuideStep(
      GUIDE_STEPS,
      buildGuideContext({
        dismissedStepIds: new Set(["welcome_start_here"]),
        hasWorkspaceNotification: true
      })
    );

    expect(step?.id).toBe("workspace_generating");
  });

  test("does not show the workspace-generating notification tooltip after any workspace has been created", () => {
    const step = getActiveGuideStep(
      GUIDE_STEPS,
      buildGuideContext({
        dismissedStepIds: new Set(["welcome_start_here"]),
        hasWorkspaceNotification: true,
        hasEverCreatedWorkspace: true
      })
    );

    expect(step).toBeNull();
  });
});
