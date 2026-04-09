/**
 * Renders a sample HelloBrand invoice PDF and runs it through the Document AI invoice processor.
 *
 * Usage:
 *   doppler run -- pnpm exec tsx scripts/verify-document-ai-invoice.ts
 */

require.extensions = require.extensions || {};
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return require.resolve("./noop-stub");
  return origResolve.call(this, request, ...args);
};

import { randomUUID } from "node:crypto";

async function main() {
  const { renderInvoicePdf } = await import("../lib/invoice-pdf");
  const { extractInvoiceTermsWithDocumentAi } = await import("../lib/document-ai-invoice");

  const now = new Date().toISOString();
  const invoice = {
    id: randomUUID(),
    dealId: "deal-smoke-test",
    userId: "user-smoke-test",
    invoiceNumber: "HB-2026-001",
    status: "finalized" as const,
    draftSavedAt: now,
    finalizedAt: now,
    sentAt: null,
    invoiceDate: "2026-04-09",
    dueDate: "2026-05-09",
    currency: "USD",
    subtotal: 5000,
    notes: "Net 30. Please remit via ACH and include invoice number HB-2026-001.",
    billTo: {
      name: "Lunchables Accounts Payable",
      email: "ap@lunchables.example",
      companyName: "Lunchables",
      address: "1 Kraft Plaza, Chicago, IL 60601",
      taxId: null,
      payoutDetails: null
    },
    issuer: {
      name: "Thomas Roberts",
      email: "thomas@example.com",
      companyName: "Thomas Roberts LLC",
      address: "123 Creator Ave, Brooklyn, NY 11201",
      taxId: "12-3456789",
      payoutDetails: "ACH • Account ending 1234"
    },
    lineItems: [
      {
        id: randomUUID(),
        deliverableId: null,
        title: "TikTok In Feed Video",
        description: "Lunchables Core CLP campaign deliverable",
        channel: "TikTok",
        quantity: 1,
        unitRate: 5000,
        amount: 5000
      }
    ],
    pdfDocumentId: null,
    manualNumberOverride: false,
    lastSentThreadId: null,
    lastSentMessageId: null,
    lastSentAccountId: null,
    lastSentToEmail: null,
    createdAt: now,
    updatedAt: now
  };

  const pdfBytes = renderInvoicePdf({
    invoice,
    workspaceLabel: "Lunchables Core CLP 2026"
  });

  console.log(`Rendered invoice PDF: ${pdfBytes.length} bytes`);

  const extraction = await extractInvoiceTermsWithDocumentAi({
    bytes: pdfBytes,
    mimeType: "application/pdf",
    deal: {
      brandName: null,
      campaignName: "Lunchables Core CLP 2026"
    }
  });

  console.log(
    JSON.stringify(
      {
        model: extraction.model,
        confidence: extraction.confidence,
        paymentAmount: extraction.data.paymentAmount,
        currency: extraction.data.currency,
        paymentTerms: extraction.data.paymentTerms,
        brandName: extraction.data.brandName,
        notes: extraction.data.notes,
        evidence: extraction.evidence.slice(0, 8)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Invoice verification failed:", error);
  process.exit(1);
});
