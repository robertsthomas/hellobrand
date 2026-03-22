import { expect, test } from "@playwright/test";

import {
  completeOnboarding,
  gotoAuthed,
  isRateLimited,
  resetOnboardingState
} from "./helpers";

test.describe("onboarding modal", () => {
  test("shows blocking modal for new user without onboarding", async ({
    page
  }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await resetOnboardingState(page);
    await page.reload();

    // Step 1 should be visible
    await expect(page.getByText("Welcome to HelloBrand")).toBeVisible();
    await expect(page.getByPlaceholder("First and last name")).toBeVisible();
    await expect(page.getByPlaceholder("@handle")).toBeVisible();
  });

  test("cannot dismiss the onboarding modal", async ({ page }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await resetOnboardingState(page);
    await page.reload();

    await expect(page.getByText("Welcome to HelloBrand")).toBeVisible();

    // Press Escape - modal should still be visible
    await page.keyboard.press("Escape");
    await expect(page.getByText("Welcome to HelloBrand")).toBeVisible();
  });

  test("step 1 requires name and handle to continue", async ({ page }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await resetOnboardingState(page);
    await page.reload();

    // Continue button should be disabled with empty fields
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();

    // Fill only name
    await page.getByPlaceholder("First and last name").fill("Test Creator");
    await expect(continueButton).toBeDisabled();

    // Fill handle too
    await page.getByPlaceholder("@handle").fill("@testcreator");
    await expect(continueButton).toBeEnabled();
  });

  test("step 1 to step 2 flow works", async ({ page }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await resetOnboardingState(page);
    await page.reload();

    // Fill step 1
    await page.getByPlaceholder("First and last name").fill("Test Creator");
    await page.getByPlaceholder("@handle").fill("@testcreator");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 should be visible
    await expect(page.getByText("Where do you create?")).toBeVisible();
    await expect(page.getByText("Instagram")).toBeVisible();
    await expect(page.getByText("TikTok")).toBeVisible();
    await expect(page.getByText("YouTube")).toBeVisible();
    await expect(page.getByText("Facebook")).toBeVisible();
  });

  test("step 2 requires at least one platform", async ({ page }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await resetOnboardingState(page);
    await page.reload();

    // Navigate to step 2
    await page.getByPlaceholder("First and last name").fill("Test Creator");
    await page.getByPlaceholder("@handle").fill("@testcreator");
    await page.getByRole("button", { name: "Continue" }).click();

    // Complete setup should be disabled without platform selection
    await expect(
      page.getByRole("button", { name: "Complete setup" })
    ).toBeDisabled();

    // Select Instagram
    await page.getByText("Instagram").click();
    await expect(
      page.getByRole("button", { name: "Complete setup" })
    ).toBeEnabled();
  });

  test("view more reveals additional platforms", async ({ page }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await resetOnboardingState(page);
    await page.reload();

    // Navigate to step 2
    await page.getByPlaceholder("First and last name").fill("Test Creator");
    await page.getByPlaceholder("@handle").fill("@testcreator");
    await page.getByRole("button", { name: "Continue" }).click();

    // Extended platforms should not be visible initially
    await expect(page.getByText("LinkedIn")).not.toBeVisible();

    // Click view more
    await page.getByText("View more platforms").click();

    // Extended platforms should now be visible
    await expect(page.getByText("LinkedIn")).toBeVisible();
    await expect(page.getByText("Twitch")).toBeVisible();
  });

  test("does not show modal for user with completed onboarding", async ({
    page
  }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await completeOnboarding(page);
    await page.reload();

    // Modal should not be visible
    await expect(page.getByText("Welcome to HelloBrand")).not.toBeVisible();

    // App content should be visible
    await expect(page.getByText("Dashboard")).toBeVisible();
  });

  test("back button returns to step 1", async ({ page }) => {
    await gotoAuthed(page, "/app");
    if (await isRateLimited(page)) return;

    await resetOnboardingState(page);
    await page.reload();

    // Navigate to step 2
    await page.getByPlaceholder("First and last name").fill("Test Creator");
    await page.getByPlaceholder("@handle").fill("@testcreator");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Where do you create?")).toBeVisible();

    // Click back
    await page.getByRole("button", { name: "Back" }).click();

    // Should be back on step 1 with values preserved
    await expect(page.getByText("Welcome to HelloBrand")).toBeVisible();
    await expect(page.getByPlaceholder("First and last name")).toHaveValue(
      "Test Creator"
    );
  });
});
