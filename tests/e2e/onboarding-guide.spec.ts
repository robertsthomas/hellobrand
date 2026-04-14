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
    await expect(firstStepTitle).toBeVisible({ timeout: 5000 });

    const nextButton = page.getByRole("button", { name: "Next" });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    await expect(
      page.getByText("Review your contract terms", { exact: true })
    ).toBeVisible({ timeout: 5000 });

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(firstStepTitle).toHaveCount(0);
    await expect(
      page.getByText("Review your contract terms", { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });
});
