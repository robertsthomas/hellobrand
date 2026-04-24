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
      page.getByRole("heading", { name: "Inbox" }).first()
    ).toBeVisible();
    await expect(page.getByText("Preview", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Sample data shown below", { exact: true })
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
      page.getByText("Sample data shown below", { exact: true })
    ).not.toBeVisible();
  });
});
