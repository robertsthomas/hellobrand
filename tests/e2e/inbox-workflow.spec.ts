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

    const notesSection = page.locator("section").filter({
      has: page.getByText("Private notes")
    });
    const noteTextarea = notesSection.getByPlaceholder(
      "Capture guidance, risks, or follow-up notes for yourself..."
    );
    await expect(noteTextarea).toBeVisible();
    await noteTextarea.fill("  Confirm usage timing before sending.  ");
    await expect(noteTextarea).toHaveValue("  Confirm usage timing before sending.  ");
    const saveNoteButton = notesSection.getByRole("button", { name: "Save note" });
    await expect(saveNoteButton).toBeEnabled({ timeout: 10000 });
    await saveNoteButton.click();
    await expect.poll(() => notePayload).not.toBeNull();
    expect(notePayload).toEqual({
      body: "Confirm usage timing before sending."
    });
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Import to workspace" }).first().click();
    await expect.poll(() => importPayload).not.toBeNull();
    expect(importPayload).toEqual({
      dealId: "deal-1"
    });
    await page.waitForLoadState("networkidle");
  });
});
