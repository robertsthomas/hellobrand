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
  const fileInput = page.locator('input[type="file"]');
  const selectedFileHeading = page.getByRole("heading", { name: input.name });
  const submitButton = page.locator('form button[type="submit"]');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await fileInput.setInputFiles(input);

    try {
      await expect(selectedFileHeading).toBeVisible({ timeout: 5000 });
      await expect(submitButton).toBeEnabled({ timeout: 5000 });
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }

      await page.waitForTimeout(500);
    }
  }
}

async function submitSelectedDocument(page: Page) {
  const analyzeButton = page.locator('form button[type="submit"]');
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

      await expect(page.getByText("Document breakdown")).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("heading", { name: "Here’s what we found" })
      ).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Amazon Kids launch brief")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create Free Workspace" }).first()
      ).toBeVisible();

      await page.getByRole("button", { name: "Create Free Workspace" }).first().click();
      await expect(page).toHaveURL(/\/login\?mode=sign-up&redirect=%2Fupload%2Fclaim/);
    });

    test("shows the free workspace gate when the anonymous preview is exhausted", async ({
      page
    }) => {
      await page.route("**/api/public/intake/upload", async (route) => {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error:
              "You’ve already used your free preview. Create a free workspace to keep going inside HelloBrand.",
            code: "ANONYMOUS_UPLOAD_LIMIT_REACHED",
            signUpHref: "/login?mode=sign-up&redirect=%2Fupload%2Fclaim",
            signInHref: "/login?mode=sign-in&redirect=%2Fupload%2Fclaim"
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
          name: "Your free preview is already used."
        })
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("link", { name: "Create free workspace" })
      ).toHaveAttribute(
        "href",
        "/login?mode=sign-up&redirect=%2Fupload%2Fclaim"
      );
      await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
        "href",
        "/login?mode=sign-in&redirect=%2Fupload%2Fclaim"
      );
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

    test("shows a recovery state when the claim token is missing", async ({ page }) => {
      await page.route("**/api/public/intake/claim", async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            title: "We couldn’t find your free preview.",
            error: "Upload a contract again to create your free workspace.",
            code: "ANONYMOUS_CLAIM_TOKEN_MISSING",
            href: "/upload",
            ctaLabel: "Upload a contract"
          })
        });
      });

      await page.goto("/upload/claim");

      await expect(
        page.getByRole("heading", { name: "We couldn’t find your free preview." })
      ).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("link", { name: "Upload a contract" })).toHaveAttribute(
        "href",
        "/upload"
      );
    });
  });
});
