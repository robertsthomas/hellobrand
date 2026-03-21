import { expect, test } from "@playwright/test";

import { TIER_SURFACE_CONTRACT } from "./fixtures/tiers";
import { getTierName, gotoAuthed } from "./helpers";

test.describe("settings", () => {
  test("settings page renders sub-tabs", async ({ page }) => {
    await gotoAuthed(page, "/app/settings");

    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }).first()
    ).toBeVisible();

    // Verify all 4 settings sub-tab links exist
    for (const tab of ["General", "Billing", "Profile", "Notifications"]) {
      await expect(page.getByRole("link", { name: tab }).last()).toBeVisible();
    }
  });

  test("billing sub-tab loads from direct url", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/billing");
    await expect(page).toHaveURL(/\/app\/settings\/billing/);
    await expect(
      page.getByRole("heading", { name: "Compare plans" })
    ).toBeVisible();
  });

  test("profile sub-tab loads from direct url", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/profile");
    await expect(page).toHaveURL(/\/app\/settings\/profile/);
    await expect(page.getByText("Display Name")).toBeVisible();
  });

  test("general tab renders settings form", async ({ page }) => {
    await gotoAuthed(page, "/app/settings");

    await expect(page.getByText("Workflow Defaults")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Accent Color" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
  });

  test("email connections gated by tier", async ({ page }, testInfo) => {
    const tier = getTierName(testInfo.project.name);

    await gotoAuthed(page, "/app/settings");

    if (TIER_SURFACE_CONTRACT[tier].settings === "full") {
      await expect(
        page.getByRole("heading", { name: "Email Connections" })
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", {
          name: "Email connections unlock on Premium"
        })
      ).toBeVisible();
    }
  });

  test("notifications sub-tab loads from direct url", async ({ page }) => {
    await gotoAuthed(page, "/app/settings/notifications");
    await expect(page).toHaveURL(/\/app\/settings\/notifications/);
  });
});
