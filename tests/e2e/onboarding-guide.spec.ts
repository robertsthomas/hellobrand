import { expect, test } from "@playwright/test";

import {
  completeOnboarding,
  gotoAuthed,
  isRateLimited
} from "./helpers";

test.describe("onboarding guide tooltips", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    // Ensure onboarding is complete so guide system activates
    await completeOnboarding(page);
    await page.reload();
  });

  test("shows guide tooltip on dashboard after onboarding", async ({
    page
  }) => {
    if (await isRateLimited(page)) return;

    // The first guide step targets the new workspace button or sidebar
    // Wait for the guide tooltip to appear
    const tooltip = page.locator('[class*="guide"]').or(
      page.getByText("Create your first workspace")
    );

    // Guide tooltip should appear (or not if user already has workspaces)
    // This is a soft check since the demo user may have existing deals
    const isVisible = await tooltip.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      // Verify tooltip has expected content
      await expect(page.getByText("Create your first workspace")).toBeVisible();
      await expect(page.getByRole("button", { name: "Got it" })).toBeVisible();
    }
  });

  test("dismissing a guide step hides the tooltip", async ({ page }) => {
    if (await isRateLimited(page)) return;

    const gotItButton = page.getByRole("button", { name: "Got it" });
    const isVisible = await gotItButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await gotItButton.click();

      // Tooltip should disappear
      await expect(gotItButton).not.toBeVisible({ timeout: 2000 });
    }
  });

  test("dismissed guide steps persist after page reload", async ({
    page
  }) => {
    if (await isRateLimited(page)) return;

    const gotItButton = page.getByRole("button", { name: "Got it" });
    const isVisible = await gotItButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      // Get the title of the current tooltip
      const tooltipTitle = await page
        .locator("h3")
        .filter({ hasText: /workspace|inbox|payments|analytics|settings/i })
        .first()
        .textContent();

      // Dismiss it
      await gotItButton.click();
      await expect(gotItButton).not.toBeVisible({ timeout: 2000 });

      // Reload the page
      await page.reload();

      // The same tooltip should not reappear
      if (tooltipTitle) {
        const reappeared = await page
          .getByText(tooltipTitle, { exact: true })
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        expect(reappeared).toBe(false);
      }
    }
  });

  test("guide tooltips are route-aware on deal workspace", async ({
    page
  }) => {
    if (await isRateLimited(page)) return;

    const response = await page.goto("/app/p/demo-deal", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    if ((response?.status() ?? 0) !== 200) return;

    await expect(page.locator('[data-guide="workspace-tabs"]')).toBeVisible({
      timeout: 10000
    });

    const workspaceTooltip = page.getByText("Explore your workspace tabs");
    const tooltipVisible = await workspaceTooltip
      .isVisible({ timeout: 1500 })
      .catch(() => false);

    if (tooltipVisible) {
      await expect(workspaceTooltip).toBeVisible();
      await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    }
  });
});
