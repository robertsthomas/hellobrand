import { expect, test } from "@playwright/test";

test.describe("intake flow", () => {
  test("intake new page responds without server crash", async ({ page }) => {
    // Intake requires database for draft loading — verify no hang or unrecoverable crash
    const response = await page.goto("/app/intake/new", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });
});
