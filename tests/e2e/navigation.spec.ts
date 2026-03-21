import { expect, test } from "@playwright/test";

import { gotoAuthed, isRateLimited } from "./helpers";

test.describe("navigation", () => {
  test("sidebar renders nav items on billing page", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");

    for (const label of [
      "Dashboard",
      "All partnerships",
      "Inbox",
      "Payments",
      "Analytics"
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    for (const label of ["Help", "Profile", "Settings"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("new workspace link is visible", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");
    await expect(page.getByText("New workspace").first()).toBeVisible();
  });

  test("/app/billing redirects to /app/settings/billing", async ({
    page
  }) => {
    await page.goto("/app/billing");
    if (await isRateLimited(page)) return;
    await expect(page).toHaveURL(/\/app\/settings\/billing/);
  });

  test("/app/profile redirects to /app/settings/profile", async ({
    page
  }) => {
    await page.goto("/app/profile");
    if (await isRateLimited(page)) return;
    await expect(page).toHaveURL(/\/app\/settings\/profile/);
  });

  test("/app/notifications redirects to /app/settings/notifications", async ({
    page
  }) => {
    await page.goto("/app/notifications");
    if (await isRateLimited(page)) return;
    await expect(page).toHaveURL(/\/app\/settings\/notifications/);
  });

  test("pricing page loads without error", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.status()).toBe(200);
  });

  test("billing settings page loads without error", async ({ page }) => {
    const response = await page.goto("/app/settings/billing");
    expect(response?.status()).toBe(200);
  });
});
