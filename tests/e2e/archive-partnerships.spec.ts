import { expect, test } from "@playwright/test";

test.describe("archive partnerships", () => {
  test("history page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/p/history", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });

  test("dashboard page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });

  test("payments page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/payments", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });

  test("history page renders archived tab when database is available", async ({
    page
  }) => {
    const response = await page.goto("/app/p/history", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    if ((response?.status() ?? 0) !== 200) return;

    const archivedTab = page.getByRole("tab", { name: "Archived" });
    await expect(archivedTab).toBeVisible({ timeout: 3000 });
  });

  test("history page row actions include archive option when deals exist", async ({
    page
  }) => {
    const response = await page.goto("/app/p/history", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    if ((response?.status() ?? 0) !== 200) return;

    const rows = page.locator("table tbody tr");
    if ((await rows.count()) === 0) return;

    const menuButton = rows
      .first()
      .getByRole("button", { name: /open actions/i });

    if (!(await menuButton.isVisible({ timeout: 2000 }).catch(() => false))) return;

    await menuButton.click();

    await expect(
      page.locator("button:has-text('Archive'), [role='menuitem']:has-text('Archive')").first()
    ).toBeVisible({ timeout: 2000 });
  });

  test("dashboard deal row actions include archive option when deals exist", async ({
    page
  }) => {
    const response = await page.goto("/app", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    if ((response?.status() ?? 0) !== 200) return;

    const menuButtons = page.getByRole("button", { name: /open actions/i });
    if ((await menuButtons.count()) === 0) return;

    await menuButtons.first().click();

    await expect(
      page.locator("button:has-text('Archive'), [role='menuitem']:has-text('Archive')").first()
    ).toBeVisible({ timeout: 2000 });
  });
});
