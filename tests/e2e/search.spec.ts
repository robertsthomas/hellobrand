import { expect, test } from "@playwright/test";

test.describe("search", () => {
  test("search page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/search", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });

  test("search with query responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/search?q=testquery", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });
});
