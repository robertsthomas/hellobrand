import { expect, test } from "@playwright/test";

import { gotoAuthed } from "./helpers";

test.describe("inbox workflow fixture", () => {
  test("persists draft, note, attachment import, and workflow actions through the new endpoints", async ({
    page
  }) => {
    let draftPayload: Record<string, unknown> | null = null;
    let notePayload: Record<string, unknown> | null = null;
    let importPayload: Record<string, unknown> | null = null;

    await page.route("**/api/email/threads/thread-1/draft", async (route) => {
      if (route.request().method() === "PUT") {
        draftPayload = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ draft: { id: "draft-1" } })
        });
        return;
      }

      await route.continue();
    });

    await page.route("**/api/email/threads/thread-1/notes", async (route) => {
      notePayload = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ note: { id: "note-2" } })
      });
    });

    await page.route("**/api/email/attachments/attachment-1/import", async (route) => {
      importPayload = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ document: { id: "document-1" } })
      });
    });

    await gotoAuthed(page, "/app/test/inbox-fixture");
    await expect(page.getByText("Thread brief", { exact: true })).toBeVisible();
    await expect(page.getByText("Rate negotiation", { exact: true })).toBeVisible();
    await expect(page.getByText("Creator to respond", { exact: true })).toBeVisible();
    const replyComposer = page.getByPlaceholder(
      'Type a reply or click "AI Reply" to generate one...'
    );
    await expect(replyComposer).toBeVisible();

    await replyComposer.fill(
      "  Thanks for the update. We can confirm once the workspace terms are final.  "
    );
    const saveDraftButton = page.getByRole("button", { name: "Save draft" });
    await expect(saveDraftButton).toBeEnabled();
    await saveDraftButton.click();
    await expect.poll(() => draftPayload).not.toBeNull();
    expect(draftPayload).toMatchObject({
      subject: "Re: Spring launch usage terms",
      body: "Thanks for the update. We can confirm once the workspace terms are final.",
      status: "in_progress",
      source: "manual"
    });

    await page.getByRole("button", { name: "Thread actions" }).click();
    await page.getByRole("button", { name: /Private notes/ }).click();
    const noteTextarea = page.getByPlaceholder(
      "Capture guidance, risks, or follow-up notes for yourself..."
    );
    await expect(noteTextarea).toBeVisible();
    await noteTextarea.fill("  Confirm usage timing before sending.  ");
    await expect(noteTextarea).toHaveValue("  Confirm usage timing before sending.  ");
    const saveNoteButton = page.getByRole("button", { name: "Save note" });
    await expect(saveNoteButton).toBeEnabled({ timeout: 10000 });
    await saveNoteButton.click();
    await expect.poll(() => notePayload).not.toBeNull();
    expect(notePayload).toEqual({
      body: "Confirm usage timing before sending."
    });
    await page
      .getByRole("dialog", { name: "Private notes" })
      .getByRole("button", { name: "Close" })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: "Private notes" })).not.toBeVisible();

    await page.getByRole("button", { name: /updated-brief\.pdf/ }).click();
    await page.getByRole("button", { name: "Import to workspace" }).click();
    await expect.poll(() => importPayload).not.toBeNull();
    expect(importPayload).toEqual({
      dealId: "deal-1"
    });
  });
});
