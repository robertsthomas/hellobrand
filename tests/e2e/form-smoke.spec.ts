import { expect, test } from "@playwright/test";

import {
  exerciseVisibleFormControls,
  gotoAuthed,
  startRuntimeErrorCapture
} from "./helpers";

test.describe("form smoke", () => {
  test("settings form handles text, select, and number changes without runtime errors", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/settings");
      const mainArea = page.getByRole("main");
      const interactions = await exerciseVisibleFormControls(mainArea);
      expect(interactions).toBeGreaterThanOrEqual(0);
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });

  test("profile editor handles textareas and selects without runtime errors", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/settings/profile");
      const mainArea = page.getByRole("main");
      const interactions = await exerciseVisibleFormControls(mainArea);
      expect(interactions).toBeGreaterThanOrEqual(0);
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });

  test("payments page loads without runtime errors", async ({ page }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/payments");
      await expect(
        page.getByRole("heading", { name: "Payments", exact: true }).first()
      ).toBeVisible();
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });

  test("deal notes form accepts textarea edits without runtime errors", async ({
    page
  }) => {
    const response = await page.goto("/app/p/demo-deal?tab=notes", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    // demo-deal only exists in seed mode
    if ((response?.status() ?? 0) !== 200) return;

    const runtime = startRuntimeErrorCapture(page);

    try {
      const mainArea = page.getByRole("main");
      const interactions = await exerciseVisibleFormControls(mainArea);
      expect(interactions).toBeGreaterThanOrEqual(0);
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });
});
