import { describe, expect, test } from "vitest";

import { detectImportantEmailEvents } from "@/lib/email/smart-inbox";
import type { EmailAttachmentRecord, EmailMessageRecord } from "@/lib/types";

function createAttachment(overrides: Partial<EmailAttachmentRecord> = {}): EmailAttachmentRecord {
  return {
    id: "attachment-1",
    messageId: "message-1",
    providerAttachmentId: "provider-attachment-1",
    filename: "agreement.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    storageKey: null,
    extractedText: null,
    createdAt: "2026-03-25T00:00:00.000Z",
    ...overrides
  };
}

function createMessage(overrides: Partial<EmailMessageRecord> = {}): EmailMessageRecord {
  return {
    id: "message-1",
    threadId: "thread-1",
    providerMessageId: "provider-message-1",
    internetMessageId: null,
    from: {
      name: "Agency",
      email: "team@example.com"
    },
    to: [
      {
        name: "Thomas",
        email: "thomas@example.com"
      }
    ],
    cc: [],
    bcc: [],
    subject: "Oreo Cakesters BTS campaign",
    textBody:
      "Dear Thomas, On behalf of TikTal OU, we are thrilled to officially invite you to collaborate with us and our client, Mondelez, for an upcoming Oreo Cakesters BTS campaign.",
    htmlBody: null,
    sentAt: "2026-03-25T00:00:00.000Z",
    receivedAt: "2026-03-25T00:00:00.000Z",
    direction: "inbound",
    hasAttachments: false,
    rawStorageKey: null,
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
    attachments: [],
    ...overrides
  };
}

describe("smart inbox event detection", () => {
  test("does not classify attachment OCR as message-level inbox updates", () => {
    const message = createMessage({
      hasAttachments: true,
      attachments: [
        createAttachment({
          filename: "OREO Cakesters _ @therobertscasa Agreement.pdf",
          extractedText:
            "Please review and sign. Payment will be net 30 after approval. Usage rights are organic and paid social for 6 months. Draft deliverables due Friday."
        })
      ]
    });

    const events = detectImportantEmailEvents(message);

    expect(events.map((event) => event.category)).toEqual(["attachment"]);
    expect(events[0]).toMatchObject({
      title: "New attachment added to linked thread"
    });
  });

  test("keeps directly stated message updates", () => {
    const message = createMessage({
      textBody:
        "Please confirm you can send the draft by Friday. Payment is net 30 after approval.",
      hasAttachments: true,
      attachments: [createAttachment()]
    });

    const events = detectImportantEmailEvents(message);

    expect(events.map((event) => event.category)).toEqual([
      "payment",
      "timeline",
      "deliverable",
      "approval",
      "ask",
      "attachment"
    ]);
  });
});
