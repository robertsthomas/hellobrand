import { expect, test } from "@playwright/test";

import { getTierName, gotoAuthed } from "./helpers";

test.describe("inbox", () => {
  test("non-premium tiers stay behind the inbox intelligence gate", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    if (tier === "premium") return;

    await gotoAuthed(page, "/app/inbox");

    await expect(
      page.getByRole("heading", { name: "Unlock inbox intelligence" })
    ).toBeVisible();
  });

  test("premium tier can access the inbox workspace", async ({
    page
  }, testInfo) => {
    const tier = getTierName(testInfo.project.name);
    if (tier !== "premium") return;

    await gotoAuthed(page, "/app/inbox");

    await expect(
      page.getByRole("heading", { name: "Inbox" }).first()
    ).toBeVisible();

    // Should not see the locked preview
    await expect(
      page.getByRole("heading", { name: "Unlock inbox intelligence" })
    ).not.toBeVisible();
  });
});
