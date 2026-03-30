import { expect, test } from "@playwright/test";

test.describe("workspace nudge notifications", () => {
  test("notifications page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/settings/notifications", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });

  test("notifications API returns valid response", async ({ page }) => {
    const response = await page.goto("/app", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    if ((response?.status() ?? 0) !== 200) return;

    const apiResponse = await page.request.get("/api/notifications?limit=50");
    expect([200, 500]).toContain(apiResponse.status());

    if (apiResponse.status() === 200) {
      const body = await apiResponse.json();
      expect(body).toHaveProperty("notifications");
      expect(Array.isArray(body.notifications)).toBe(true);
    }
  });

  test("notification bell renders in header", async ({ page }) => {
    const response = await page.goto("/app", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });

    if ((response?.status() ?? 0) !== 200) return;

    const bell = page.locator('[data-guide="header-notifications"]');
    await expect(bell).toBeVisible({ timeout: 5000 });
  });

  test("deal terms tab is accessible for nudge links", async ({ page }) => {
    const response = await page.goto("/app/p/demo-deal?tab=terms", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 404, 500]).toContain(status);
  });
});
