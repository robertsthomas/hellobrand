import { expect, test } from "@playwright/test";

import { gotoAuthed } from "./helpers";

test.describe("workspace invoices", () => {
  test("workspace invoice tab can generate a draft invoice", async ({ page }) => {
    await gotoAuthed(page, "/app/p/demo-deal?tab=invoices");
    await expect(page.getByRole("heading", { name: /generate a workspace invoice/i })).toBeVisible();

    await page.getByRole("button", { name: /generate invoice/i }).click();

    await expect(page.getByRole("heading", { name: /HB-\d+/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /finalize and attach pdf/i })).toBeVisible();
  });
});
