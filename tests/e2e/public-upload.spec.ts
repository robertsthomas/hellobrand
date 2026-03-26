import { expect, test, type Page } from "@playwright/test";

const EMPTY_STORAGE_STATE = {
  cookies: [],
  origins: []
};

function sampleBreakdown() {
  return {
    brandName: "Amazon Kids",
    contractTitle: "Amazon Kids launch brief",
    contractSummary:
      "Create launch content for Alexa with a short approval window and a fixed campaign fee.",
    paymentAmount: 2500,
    currency: "USD",
    paymentSummary: "$2,500 • Paid within 30 days of final post",
    deliverables: [
      {
        id: "deliverable-1",
        title: "TikTok post",
        quantity: 2,
        channel: "TikTok",
        description: "Show the family setup flow.",
        dueDate: "2026-04-01"
      }
    ],
    riskFlags: [
      {
        id: "risk-1",
        title: "Usage rights are broad",
        detail: "The brand can reuse the content for paid media without a separate fee.",
        severity: "medium",
        suggestedAction: "Add a paid usage fee and duration cap."
      }
    ],
    documentKind: "campaign_brief",
    sourceFileName: "amazon-kids-brief.docx"
  };
}

async function setDocumentFile(
  page: Page,
  input: { name: string; mimeType: string; buffer: Buffer }
) {
  await page.locator('input[type="file"]').setInputFiles(input);
  await expect(page.getByText(input.name, { exact: true })).toBeVisible();
}

async function submitSelectedDocument(page: Page) {
  const analyzeButton = page.getByRole("button", { name: "Analyze document" });
  await expect(analyzeButton).toBeEnabled({ timeout: 15000 });
  await analyzeButton.click();
}

test.describe("public upload", () => {
  test.describe.configure({ mode: "serial" });

  test.describe("anonymous visitor", () => {
    test.use({ storageState: EMPTY_STORAGE_STATE });

    test("renders a mocked anonymous analysis result and save CTA", async ({
      page
    }) => {
      await page.route("**/api/public/intake/upload", async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            analysisToken: "anon_test_token",
            breakdown: sampleBreakdown(),
            expiresAt: "2026-03-27T14:34:45.940Z"
          })
        });
      });

      await page.goto("/upload");
      await setDocumentFile(page, {
        name: "amazon-kids-brief.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from("brief")
      });

      await submitSelectedDocument(page);

      await expect(page.getByText("Anonymous preview")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Here’s what we found" })).toBeVisible();
      await expect(page.getByText("Amazon Kids launch brief")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save My Deal" }).first()).toBeVisible();
    });

    test("shows the quota signup gate when free uploads are exhausted", async ({
      page
    }) => {
      await page.route("**/api/public/intake/upload", async (route) => {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error:
              "You’ve used all 3 free anonymous uploads. Create an account to continue inside HelloBrand.",
            code: "ANONYMOUS_UPLOAD_LIMIT_REACHED",
            redirectTo: "/login?mode=sign-up&redirect=%2Fapp%2Fintake%2Fnew"
          })
        });
      });

      await page.goto("/upload");
      await setDocumentFile(page, {
        name: "creator-contract.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("contract")
      });

      await submitSelectedDocument(page);

      await expect(
        page.getByRole("heading", {
          name: "Your free anonymous uploads are used up."
        })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Create an account" })
      ).toHaveAttribute(
        "href",
        "/login?mode=sign-up&redirect=%2Fapp%2Fintake%2Fnew"
      );
      await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    });

    test("shows the unsupported-document message returned by the server", async ({
      page
    }) => {
      await page.route("**/api/public/intake/upload", async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error:
              "This looks like an invoice. Upload a contract, brief, or concept document instead."
          })
        });
      });

      await page.goto("/upload");
      await setDocumentFile(page, {
        name: "invoice.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("invoice")
      });

      await submitSelectedDocument(page);

      await expect(
        page.getByText(
          "This looks like an invoice. Upload a contract, brief, or concept document instead."
        )
      ).toBeVisible();
    });

    test("blocks oversized files on the client before the upload request fires", async ({
      page
    }) => {
      let uploadRequests = 0;

      await page.route("**/api/public/intake/upload", async (route) => {
        uploadRequests += 1;
        await route.fulfill({
          status: 500,
          body: ""
        });
      });

      await page.goto("/upload");
      await setDocumentFile(page, {
        name: "huge-brief.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(11 * 1024 * 1024)
      });

      await submitSelectedDocument(page);

      await expect(
        page.getByText("Please upload a document smaller than 10 MB.")
      ).toBeVisible();
      expect(uploadRequests).toBe(0);
    });
  });
});
