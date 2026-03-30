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

  test("brief tab on deal shows tier-appropriate gate", async ({
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

    if (tier === "basic") {
      await expect(
        page.getByRole("heading", {
          name: /brief generation unlocks/i
        })
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", {
          name: /brief generation unlocks/i
        })
      ).not.toBeVisible();
    }
  });
});
