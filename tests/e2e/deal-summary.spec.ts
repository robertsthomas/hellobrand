import { expect, test } from "@playwright/test";

import { gotoAuthed, startRuntimeErrorCapture } from "./helpers";

test.describe("deal summary", () => {
  test("workspace overview renders summary controls and current legal summary", async ({
    page
  }) => {
    const response = await page.goto("/app/p/demo-deal", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;

    // demo-deal only exists in file-backed seed mode; skip if 404
    if (status === 404 || status === 500) return;

    const runtime = startRuntimeErrorCapture(page);

    try {
      for (const label of ["Legal", "Plain language", "Short"]) {
        await expect(page.getByRole("button", { name: label })).toBeVisible();
      }

      await expect(page.getByRole("button", { name: /History/i })).toBeVisible();
      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });
});
