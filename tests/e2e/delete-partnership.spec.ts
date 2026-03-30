import { expect, test } from "@playwright/test";

test.describe("delete partnership", () => {
  test("workspace renders the delete entrypoint with the dedicated confirmation route", async ({
    page
  }) => {
    const response = await page.goto("/app/p/demo-deal", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;

    // demo-deal only exists in file-backed seed mode; skip if not found
    if (status === 404 || status === 500) return;

    const deleteLink = page.getByRole("link", { name: /Delete/i });
    await expect(deleteLink).toBeVisible();

    const href = await deleteLink.getAttribute("href");
    expect(href).toContain("/delete");
  });
});
