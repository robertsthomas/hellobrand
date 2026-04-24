import { expect, test } from "@playwright/test";

import { getTierName, gotoAuthed, isRateLimited } from "./helpers";

test.describe("analytics filters and drill-downs", () => {
  test("premium analytics exposes filter controls and drill-down entry points", async ({
    page,
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    if (tier !== "premium") return;

    await gotoAuthed(page, "/app/analytics");
    if (await isRateLimited(page)) return;

    await expect(page.getByLabel("Brand filter")).toBeVisible();
    await expect(page.getByLabel("Status filter")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View all workspaces" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open payments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pipeline breakdown" })).toBeVisible();
  });

  test("premium analytics supports empty-state filtering and reset", async ({
    page,
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    if (tier !== "premium") return;

    await gotoAuthed(page, "/app/analytics?range=30d&brand=__no_match__");
    if (await isRateLimited(page)) return;

    await expect(page).toHaveURL(/range=30d/);
    await expect(page.getByText("No workspaces available yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Reset filters" })).toBeVisible();
  });
});
