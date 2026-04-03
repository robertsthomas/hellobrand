import { expect, test } from "@playwright/test";

import { gotoAuthed } from "./helpers";

test.describe("onboarding page", () => {
  test("renders the onboarding introduction", async ({ page }) => {
    await gotoAuthed(page, "/app/onboarding");

    await expect(
      page.getByRole("heading", { name: "Welcome to HelloBrand" })
    ).toBeVisible();
    await expect(
      page.getByText("Let's get your creator workspace set up in three simple steps.")
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Upload your first partnership docs" })
    ).toBeVisible();
  });

  test("upload CTA links to the intake flow", async ({ page }) => {
    await gotoAuthed(page, "/app/onboarding");

    await expect(
      page.getByRole("link", { name: "Upload your first documents" })
    ).toHaveAttribute("href", "/app/intake/new");
  });

  test("skip CTA returns to the dashboard", async ({ page }) => {
    await gotoAuthed(page, "/app/onboarding");

    await expect(
      page.getByRole("link", { name: "Skip and explore" })
    ).toHaveAttribute("href", "/app");
  });
});
