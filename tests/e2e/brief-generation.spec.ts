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

    // All tiers show the meter, but limits differ
    // Basic: 0/3, Standard: 0/30, Premium: Unlimited
    if (tier === "premium") {
      await expect(page.getByText("Unlimited").first()).toBeVisible();
    }
  });

  test("brief tab on deal shows tier-appropriate gate", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);

    const response = await page.goto("/app/deals/demo-deal?tab=brief");
    const status = response?.status() ?? 0;

    if (tier === "basic") {
      // Basic should see the upgrade gate
      await expect(
        page.getByRole("heading", {
          name: "AI brief generation unlocks on Standard"
        })
      ).toBeVisible();
    } else {
      // Standard/Premium have access — demo-deal doesn't exist so expect
      // no upgrade gate (either 404 or the brief generator)
      await expect(
        page.getByRole("heading", {
          name: "AI brief generation unlocks on Standard"
        })
      ).not.toBeVisible();
      expect([200, 404]).toContain(status);
    }
  });
});
