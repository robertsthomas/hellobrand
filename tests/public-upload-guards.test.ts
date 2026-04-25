import { describe, expect, test } from "vitest";

import { ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES } from "@/lib/public-upload-config";
import {
  ALLOWED_PUBLIC_UPLOAD_DOCUMENT_KINDS,
  getUnsupportedPublicUploadDocumentMessage,
  isAllowedPublicUploadDocumentKind,
} from "@/lib/public-upload-document-kind";
import { validateAnonymousUploadFile } from "@/lib/public-upload-guards";
import type { DocumentKind } from "@/lib/types";

describe("public upload document kind rules", () => {
  test("allows only contract, brief, and concept document kinds", () => {
    expect(ALLOWED_PUBLIC_UPLOAD_DOCUMENT_KINDS).toEqual([
      "contract",
      "campaign_brief",
      "deliverables_brief",
      "pitch_deck",
    ]);

    for (const documentKind of ALLOWED_PUBLIC_UPLOAD_DOCUMENT_KINDS) {
      expect(isAllowedPublicUploadDocumentKind(documentKind)).toBe(true);
    }

    const blockedKinds: DocumentKind[] = ["invoice", "email_thread", "unknown"];
    for (const documentKind of blockedKinds) {
      expect(isAllowedPublicUploadDocumentKind(documentKind)).toBe(false);
    }
  });

  test("returns specific rejection copy for unsupported kinds", () => {
    expect(getUnsupportedPublicUploadDocumentMessage("invoice")).toBe(
      "This looks like an invoice. Upload a contract, brief, or concept document instead."
    );
    expect(getUnsupportedPublicUploadDocumentMessage("email_thread")).toBe(
      "This looks like an email thread. Upload a contract, brief, or concept document instead."
    );
    expect(getUnsupportedPublicUploadDocumentMessage("unknown")).toBe(
      "We could not recognize this as a contract, brief, or concept document. Upload one of those document types instead."
    );
  });
});

describe("public upload file validation", () => {
  test("accepts supported document files within the size limit", () => {
    expect(() =>
      validateAnonymousUploadFile({
        name: "creator-brief.pptx",
        size: ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES,
      })
    ).not.toThrow();
  });

  test("rejects unsupported extensions", () => {
    expect(() =>
      validateAnonymousUploadFile({
        name: "deal-preview.png",
        size: 1024,
      })
    ).toThrow("Please upload a PDF, DOC, DOCX, PPTX, or TXT document.");
  });

  test("rejects files over 10 MB", () => {
    expect(() =>
      validateAnonymousUploadFile({
        name: "creator-brief.pdf",
        size: ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES + 1,
      })
    ).toThrow("Please upload a document smaller than 10 MB.");
  });
});
