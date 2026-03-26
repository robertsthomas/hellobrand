import type { DocumentKind } from "@/lib/types";

export const ALLOWED_PUBLIC_UPLOAD_DOCUMENT_KINDS: DocumentKind[] = [
  "contract",
  "campaign_brief",
  "deliverables_brief",
  "pitch_deck"
];

export function isAllowedPublicUploadDocumentKind(documentKind: DocumentKind) {
  return ALLOWED_PUBLIC_UPLOAD_DOCUMENT_KINDS.includes(documentKind);
}

export function getUnsupportedPublicUploadDocumentMessage(documentKind: DocumentKind) {
  switch (documentKind) {
    case "invoice":
      return "This looks like an invoice. Upload a contract, brief, or concept document instead.";
    case "email_thread":
      return "This looks like an email thread. Upload a contract, brief, or concept document instead.";
    case "unknown":
      return "We could not recognize this as a contract, brief, or concept document. Upload one of those document types instead.";
    default:
      return "Upload a contract, brief, or concept document to start a workspace.";
  }
}
