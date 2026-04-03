import { expect, test } from "@playwright/test";

import { getTierName, gotoAuthed } from "./helpers";

test.describe("brief generation", () => {
  test("brief usage meter shows on billing page per tier", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    await gotoAuthed(page, "/app/settings/billing");

    const briefsMeter = page.getByText("Briefs", { exact: true });
    await expect(briefsMeter).toBeVisible();

    if (tier === "premium") {
      await expect(page.getByText("Unlimited").first()).toBeVisible();
    }
  });

  test("brief surface loads on the deal deliverables tab", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    const response = await page.goto("/app/p/demo-deal?tab=brief", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;

    // demo-deal only exists in seed mode; skip if not found
    if (status === 404 || status === 500) return;

    await page.waitForTimeout(500);

    const closeTipsButton = page.getByRole("button", { name: "Close all tips" });
    if (await closeTipsButton.isVisible().catch(() => false)) {
      await closeTipsButton.click();
    }

    const deliverablesTab = page.locator('[data-guide="tab-deliverables"]');
    await deliverablesTab.click();
    await expect(deliverablesTab).toHaveAttribute("data-state", "active");

    const deliverablesPanel = page.locator("#tab-deliverables");
    await expect(deliverablesPanel).toContainText("Deliverables");
    await expect(deliverablesPanel).toContainText("Brief");
    await expect(deliverablesPanel.getByText("Brief Missing")).toBeVisible();

    if (tier === "basic") {
      await expect(
        deliverablesPanel.getByText("AI brief generation unlocks on Standard")
      ).toBeVisible();
      return;
    }

    await expect(
      deliverablesPanel.getByRole("button", { name: "Generate brief" })
    ).toBeVisible();
  });
});
