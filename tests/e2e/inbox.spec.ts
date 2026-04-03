import { expect, test } from "@playwright/test";

import { getTierName, gotoAuthed } from "./helpers";

test.describe("inbox", () => {
  test("inbox page loads without crashing", async ({ page }) => {
    const response = await page.goto("/app/inbox");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText(
      "Application error"
    );
  });

  test("non-premium tiers see locked preview with dummy data", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    if (tier === "premium") return;

    await gotoAuthed(page, "/app/inbox");

    // Preview badge
    await expect(page.getByText("Preview")).toBeVisible();

    // Sample data indicator
    await expect(page.getByText("Sample data shown below")).toBeVisible();

    // Dummy thread data should be visible
    await expect(page.getByText("Sarah Chen").first()).toBeVisible();
    await expect(page.getByText("Glossier").first()).toBeVisible();
  });

  test("non-premium inbox shows multiple dummy threads", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    if (tier === "premium") return;

    await gotoAuthed(page, "/app/inbox");

    await expect(page.getByText("6 conversations")).toBeVisible();
  });

  test("premium tier sees inbox workspace", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    if (tier !== "premium") return;

    await gotoAuthed(page, "/app/inbox");

    await expect(
      page.getByRole("heading", { name: "Inbox" }).first()
    ).toBeVisible();

    // Should not see the locked preview
    await expect(
      page.getByRole("heading", { name: "Unlock inbox intelligence" })
    ).not.toBeVisible();
  });
});
