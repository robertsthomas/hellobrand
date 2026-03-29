import { expect, test } from "@playwright/test";

import { gotoAuthed, startRuntimeErrorCapture } from "./helpers";

test.describe("delete partnership", () => {
  test("workspace renders the delete entrypoint with the dedicated confirmation route", async ({
    page
  }) => {
    const runtime = startRuntimeErrorCapture(page);

    try {
      await gotoAuthed(page, "/app/p/demo-deal");

      const deleteLink = page.getByRole("link", {
        name: /Delete Nimbus Athletics - Spring Recovery Drop/i
      });

      await expect(deleteLink).toBeVisible();
      await expect(deleteLink).toHaveAttribute(
        "href",
        "/app/p/demo-deal/delete?redirectTo=%2Fapp%2Fp%2Fhistory"
      );

      await runtime.assertNoRuntimeErrors();
    } finally {
      runtime.dispose();
    }
  });
});
