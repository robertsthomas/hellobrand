import { expect, test } from "@playwright/test";

import { gotoAuthed, startRuntimeErrorCapture } from "./helpers";

const LEGAL_SUMMARY =
  "This deal appears to pay $2,000 for one Instagram Reel and two Story frames. Payment is Net 45 after invoice, and the brand receives six months of paid social usage with a 30-day footwear exclusivity period.";

test.describe("deal summary", () => {
  test("workspace overview renders summary controls and current legal summary", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/p/demo-deal");

      await expect(page.getByText(LEGAL_SUMMARY)).toBeVisible();

      for (const label of ["Legal", "Plain language", "Short"]) {
        await expect(page.getByRole("button", { name: label })).toBeVisible();
      }

      await expect(page.getByRole("button", { name: /History/i })).toBeVisible();
      await expect(page.getByText("Mar 29, 2026")).toBeVisible();

      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });
});
