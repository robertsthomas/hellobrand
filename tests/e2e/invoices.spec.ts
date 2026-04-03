import { expect, test } from "@playwright/test";

import { gotoAuthed } from "./helpers";

test.describe("workspace invoices", () => {
  test("workspace invoice page exposes a usable draft flow", async ({ page }) => {
    await gotoAuthed(page, "/app/p/demo-deal/invoice");

    const draftHeading = page.getByRole("heading", { name: /HB-\d+/i });
    const hasDraft = await draftHeading.isVisible().catch(() => false);

    if (hasDraft) {
      await expect(page.getByRole("button", { name: /save draft/i })).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: /generate a workspace invoice/i })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /generate invoice/i })
      ).toBeVisible();
    }
  });
});
