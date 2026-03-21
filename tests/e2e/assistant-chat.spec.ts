import { expect, test } from "@playwright/test";

import { getTierName, gotoAuthed } from "./helpers";

test.describe("assistant chat", () => {
  test("assistant usage meter shows on billing page", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");

    // Scope to main content to avoid matching the floating assistant button
    await expect(
      page.getByRole("main").getByText("Assistant", { exact: true })
    ).toBeVisible();
  });

  test("assistant usage limits differ by tier", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    await gotoAuthed(page, "/app/settings/billing");

    if (tier === "premium") {
      // Premium has unlimited assistant usage
      await expect(page.getByText("Unlimited").first()).toBeVisible();
    } else {
      // Basic/Standard have capped usage shown as "0/N"
      await expect(page.getByText(/0\/\d+/).first()).toBeVisible();
    }
  });
});
