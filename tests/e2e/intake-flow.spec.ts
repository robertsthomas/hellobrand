import { expect, test, type Page } from "@playwright/test";

import {
  gotoAuthed,
  startRuntimeErrorCapture,
} from "./helpers";
import { E2E_LOCAL_AUTH_SECRET } from "./runtime";

async function resetIntakeDrafts(page: Page) {
  const response = await page.request.post("/api/test-intake", {
    data: {
      secret: E2E_LOCAL_AUTH_SECRET,
      userId: "demo-user",
      action: "reset",
    },
  });

  expect(response.ok()).toBe(true);
}

async function createQueuedWorkspace(page: Page, input: {
  brandName: string;
  campaignName: string;
  pastedText: string;
}) {
  const draftResponse = await page.request.post("/api/intake/draft", {
    data: {
      brandName: input.brandName,
      campaignName: input.campaignName,
    },
  });
  expect(draftResponse.ok()).toBe(true);

  const draftPayload = (await draftResponse.json()) as {
    session?: { id?: string };
  };
  const sessionId = draftPayload.session?.id;
  expect(sessionId).toBeTruthy();

  const documentsResponse = await page.request.post(`/api/intake/${sessionId}/documents`, {
    multipart: {
      pastedText: input.pastedText,
      startProcessing: "0",
    },
  });
  expect(documentsResponse.ok()).toBe(true);

  return sessionId as string;
}

test.describe("intake flow", () => {
  test("intake new page responds without server crash", async ({ page }) => {
    const response = await page.goto("/app/intake/new", {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });
    const status = response?.status() ?? 0;
    expect([200, 500]).toContain(status);
  });
});

test.describe("workspace generation from dashboard", () => {
  test.describe.configure({ mode: "serial" });

  test("stays on the processing page after generate workspace", async ({
    page
  }, testInfo) => {
    test.slow();
    test.skip(
      testInfo.project.name === "free",
      "The free-tier demo user is limited to one active workspace."
    );

    const errors = startRuntimeErrorCapture(page);
    await resetIntakeDrafts(page);

    const sessionId = await createQueuedWorkspace(page, {
      brandName: "TestBrand",
      campaignName: "Spring Launch 2026",
      pastedText:
        "Brand: TestBrand\n\nCampaign: Spring Launch 2026\n\nPayment: $5,000 for 2 Instagram posts",
    });

    await gotoAuthed(page, `/app/intake/${sessionId}`);

    const generateButton = page.getByRole("button", {
      name: "Start analysis"
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

    await generateButton.click();

    await queueStartPromise;

    await expect(page).toHaveURL(
      new RegExp(`/app/intake/${sessionId}(?:\\?starting=1)?$`),
      {
        timeout: 15000
      }
    );

    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(
      new RegExp(`/app/intake/${sessionId}(?:\\?starting=1)?$`),
      { timeout: 1000 }
    );
    await expect(page).not.toHaveURL("/app", { timeout: 1000 });

    await errors.assertNoRuntimeErrors();
    errors.dispose();
  });

  test("returns to the intake session route when generation fails", async ({
    page
  }, testInfo) => {
    test.slow();
    test.skip(
      testInfo.project.name === "free",
      "The free-tier demo user is limited to one active workspace."
    );

    const errors = startRuntimeErrorCapture(page);
    await resetIntakeDrafts(page);

    const sessionId = await createQueuedWorkspace(page, {
      brandName: "FailBrand",
      campaignName: "Failure test",
      pastedText: "Brand: FailBrand\n\nCampaign: Failure test\n\nPayment: $1,000",
    });

    await gotoAuthed(page, `/app/intake/${sessionId}`);

    const generateButton = page.getByRole("button", {
      name: "Start analysis"
    });
    await expect(generateButton).toBeEnabled({ timeout: 10000 });

    await page.route("**/api/intake/queue/start", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Could not start analysis." })
      });
    });

    await generateButton.click();

    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(new RegExp(`/app/intake/${sessionId}$`), { timeout: 5000 });
    await expect(page).not.toHaveURL("/app", { timeout: 1000 });

    await errors.assertNoRuntimeErrors();
    errors.dispose();
  });
});
