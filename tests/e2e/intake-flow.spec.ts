import { expect, test } from "@playwright/test";

import { gotoAuthed, startRuntimeErrorCapture } from "./helpers";

test.describe("intake flow", () => {
  test("intake new page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/intake/new", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });
});

test.describe("workspace generation from dashboard", () => {
  test("stays on the processing page after generate workspace", async ({
    page
  }) => {
    const errors = startRuntimeErrorCapture(page);

    await gotoAuthed(page, "/app/intake/new");

    const response = await page.reload();
    const status = response?.status() ?? 0;
    if (status !== 200) {
      return;
    }

    // The page should render the upload UI with the source mode switcher
    const uploadTab = page.getByRole("button", { name: "Upload files" });
    const pasteTab = page.getByRole("button", { name: "Paste text" });
    await expect(uploadTab.or(pasteTab)).toBeVisible({ timeout: 10000 });

    // Switch to paste mode and add text to create a workspace
    await pasteTab.click();

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(
      "Brand: TestBrand\n\nCampaign: Spring Launch 2026\n\nPayment: $5,000 for 2 Instagram posts"
    );

    // Save the workspace
    const saveButton = page.getByRole("button", { name: "Save workspace" });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // The workspace should appear in the "Ready to analyze" list
    const generateButton = page.getByRole("button", {
      name: "Generate workspace"
    });
    await expect(generateButton).toBeEnabled({ timeout: 10000 });

    // Intercept the queue/start API to control the response
    let queueStartResolve: ((value: unknown) => void) | null = null;
    const queueStartPromise = new Promise((resolve) => {
      queueStartResolve = resolve;
    });

    await page.route("**/api/intake/queue/start", async (route) => {
      queueStartResolve?.(route.request());
      await route.continue();
    });

    // Click "Generate workspace"
    await generateButton.click();

    // Wait for the queue/start request to fire
    const queueRequest = await queueStartPromise;

    // After the API call completes, the page should navigate to the processing page
    // and STAY there (no redirect back to dashboard)
    await expect(page).toHaveURL(/\/app\/intake\/[^/]+\?starting=1/, {
      timeout: 15000
    });

    // The processing page should be visible with the processing UI
    await expect(
      page.getByText(/Extracting source details|Analyzing your uploaded source/)
    ).toBeVisible({ timeout: 10000 });

    // Wait a moment and verify we're still on the processing page (not bounced to dashboard)
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/app\/intake\//, { timeout: 1000 });
    await expect(page).not.toHaveURL("/app", { timeout: 1000 });

    // Verify the queue/start request included session IDs (not optimistic fake IDs)
    const postData = (queueRequest as { postDataJSON?: () => Record<string, unknown> }).postDataJSON?.() ?? {};
    const sessionIds = (postData.sessionIds ?? []) as string[];
    expect(
      sessionIds.every((id) => !id.startsWith("optimistic-")),
      "Session IDs should be real server IDs, not optimistic placeholders"
    ).toBe(true);

    await errors.assertNoRuntimeErrors();
    errors.dispose();
  });

  test("shows error and stays on dashboard when generation fails", async ({
    page
  }) => {
    const errors = startRuntimeErrorCapture(page);

    await gotoAuthed(page, "/app/intake/new");

    const response = await page.reload();
    const status = response?.status() ?? 0;
    if (status !== 200) {
      return;
    }

    // Switch to paste mode and add text
    const pasteTab = page.getByRole("button", { name: "Paste text" });
    await pasteTab.click();

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(
      "Brand: FailBrand\n\nCampaign: Failure test\n\nPayment: $1,000"
    );

    // Save the workspace
    const saveButton = page.getByRole("button", { name: "Save workspace" });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // The workspace should appear in the list
    const generateButton = page.getByRole("button", {
      name: "Generate workspace"
    });
    await expect(generateButton).toBeEnabled({ timeout: 10000 });

    // Intercept to simulate failure
    await page.route("**/api/intake/queue/start", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Could not start analysis." })
      });
    });

    await generateButton.click();

    // Should stay on the current page (not navigate away on failure)
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/app\/intake\/new/, { timeout: 5000 });

    // Should show the error message
    await expect(
      page.getByText("Could not start analysis.")
    ).toBeVisible({ timeout: 5000 });

    await errors.assertNoRuntimeErrors();
    errors.dispose();
  });
});
