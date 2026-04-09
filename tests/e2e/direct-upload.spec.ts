import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { getTierName, gotoAuthed, startRuntimeErrorCapture } from "./helpers";

const BRIEF_PDF_PATH = path.join(
  process.cwd(),
  "example-docs",
  "HB-BEAUTY-001 campaign_brief.pdf"
);

test.describe("direct upload flow", () => {
  test("create workspace uses direct register instead of legacy multipart upload", async ({
    page
  }, testInfo) => {
    test.skip(
      getTierName(testInfo.project.name) !== "premium",
      "This flow should be verified on the unrestricted premium tier."
    );

    const errors = startRuntimeErrorCapture(page);
    const directRegisterRequests: string[] = [];
    const legacyUploadRequests: string[] = [];

    page.on("request", (request) => {
      if (request.method() !== "POST") {
        return;
      }

      const url = request.url();
      if (/\/api\/intake\/[^/]+\/documents\/direct\/register$/.test(url)) {
        directRegisterRequests.push(url);
        return;
      }

      if (/\/api\/intake\/[^/]+\/documents$/.test(url)) {
        legacyUploadRequests.push(url);
      }
    });

    await gotoAuthed(page, "/app/intake/new");

    const response = await page.reload();
    const status = response?.status() ?? 0;
    expect(status).toBe(200);

    const addAnotherWorkspaceButton = page.getByRole("button", {
      name: "Add another workspace"
    });
    if (await addAnotherWorkspaceButton.isVisible().catch(() => false)) {
      await addAnotherWorkspaceButton.click();
    }

    await expect(
      page
        .getByRole("button", { name: "Add documents" })
        .or(page.getByRole("button", { name: "Add more" }))
    ).toBeVisible({
      timeout: 10000
    });

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: `playwright-direct-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      buffer: await readFile(BRIEF_PDF_PATH)
    });

    await expect(page.getByRole("button", { name: "Add more" })).toBeVisible({
      timeout: 10000
    });

    const saveButton = page.getByRole("button", { name: "Save workspace" });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    await expect(
      page.getByRole("heading", { name: "Ready to analyze" })
    ).toBeVisible({ timeout: 10000 });

    const generateButton = page.getByRole("button", { name: "Generate workspace" });
    await expect(generateButton).toBeEnabled({ timeout: 10000 });
    await generateButton.click();

    await expect
      .poll(() => directRegisterRequests.length, {
        timeout: 15000,
        message: "expected direct register request to fire"
      })
      .toBeGreaterThan(0);

    expect(legacyUploadRequests).toEqual([]);

    await expect(
      page
        .getByRole("button", { name: "Starting generation..." })
        .or(page.locator('[aria-busy="true"]'))
    ).toBeVisible({
      timeout: 10000
    });

    await errors.assertNoRuntimeErrors();
    errors.dispose();
  });
});
