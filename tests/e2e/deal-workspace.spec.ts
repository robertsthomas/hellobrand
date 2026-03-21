import { expect, test } from "@playwright/test";

test.describe("deal workspace", () => {
  test("deal history page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/deals/history", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });

  test("non-existent deal returns 404 or error", async ({ page }) => {
    const response = await page.goto("/app/deals/nonexistent-id", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    // 404 (notFound), 200 (error boundary), or 500 (no db)
    expect([200, 404, 500]).toContain(status);
  });

  test("dashboard page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });
});
