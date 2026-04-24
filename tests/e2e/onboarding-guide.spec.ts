import { expect, test } from "@playwright/test";

import {
  completeOnboarding,
  gotoAuthed,
  resetOnboardingState
} from "./helpers";

test.describe("onboarding guide persistence", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, "/app/p/demo-deal");
    await resetOnboardingState(page);
    await completeOnboarding(page);
    await page.reload({ waitUntil: "domcontentloaded" });
  });

  test("dismissed workspace guide steps persist after reload", async ({
    page
  }) => {
    await expect(page.locator('[data-guide="workspace-tabs"]')).toBeVisible({
      timeout: 10000
    });

    const firstStepTitle = page.getByText("Your partnership workspace", {
      exact: true
    });
    const isFirstStepVisible = await firstStepTitle.isVisible().catch(() => false);

    if (isFirstStepVisible) {
      const nextButton = page.getByRole("button", { name: "Next", exact: true });
      await expect(nextButton).toBeVisible();
      await nextButton.click();
      await expect(firstStepTitle).toHaveCount(0, { timeout: 5000 });
    }

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(firstStepTitle).toHaveCount(0);
  });
});
