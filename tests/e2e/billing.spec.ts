import { expect, test } from "@playwright/test";

import { getTierName, gotoAuthed } from "./helpers";

test.describe("billing", () => {
  test("billing page shows usage meters", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");

    for (const label of ["Workspaces", "AI drafts", "Briefs"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // "Assistant" appears in both the usage meter and the floating button,
    // so scope to main content area
    await expect(
      page.getByRole("main").getByText("Assistant", { exact: true })
    ).toBeVisible();
  });

  test("billing page shows 3 plan cards", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");

    await expect(
      page.getByRole("heading", { name: "Compare plans" })
    ).toBeVisible();

    const planSection = page
      .getByRole("heading", { name: "Compare plans" })
      .locator("..")
      .locator("..");
    const cards = planSection.locator("article");
    await expect(cards).toHaveCount(3);

    await expect(cards.nth(0)).toContainText("Basic");
    await expect(cards.nth(1)).toContainText("Standard");
    await expect(cards.nth(2)).toContainText("Premium");
  });

  test("plan cards show prices and features", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");

    const planSection = page
      .getByRole("heading", { name: "Compare plans" })
      .locator("..")
      .locator("..");
    const cards = planSection.locator("article");

    for (const [index, price] of ["$19/mo", "$49/mo", "$99/mo"].entries()) {
      await expect(cards.nth(index)).toContainText(price);
    }

    for (let i = 0; i < 3; i++) {
      const featureItems = cards.nth(i).locator("li");
      expect(await featureItems.count()).toBeGreaterThanOrEqual(3);
    }
  });

  test("current plan card is highlighted per tier", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    await gotoAuthed(page, "/app/settings/billing");

    const planSection = page
      .getByRole("heading", { name: "Compare plans" })
      .locator("..")
      .locator("..");
    const cards = planSection.locator("article");

    const tierIndex = { basic: 0, standard: 1, premium: 2 }[tier];
    await expect(cards.nth(tierIndex)).toContainText("Current");
  });

  test("stripe warning banner shows in e2e mode", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");

    await expect(
      page.getByText("Billing setup is still being finished")
    ).toBeVisible();
  });

  test("checkout buttons are disabled without stripe", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");

    const startButtons = page.getByRole("button", { name: "Start monthly" });
    const count = await startButtons.count();

    for (let i = 0; i < count; i++) {
      await expect(startButtons.nth(i)).toBeDisabled();
    }
  });
});
