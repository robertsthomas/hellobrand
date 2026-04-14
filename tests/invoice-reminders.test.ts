import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMock = {
  getDealAggregate: vi.fn(),
  listInvoiceReminderTouchpoints: vi.fn(),
  updateInvoiceReminderTouchpoint: vi.fn(),
  upsertInvoiceReminderTouchpoints: vi.fn()
};

vi.mock("@/lib/repository", () => ({
  getRepository: () => repositoryMock
}));

vi.mock("@/lib/profile", () => ({
  getProfileForViewer: vi.fn()
}));

vi.mock("@/lib/profile-metadata", () => ({
  parseProfileMetadata: vi.fn(() => ({}))
}));

vi.mock("@/lib/intake-normalization", () => ({
  buildNormalizedIntakeRecord: vi.fn()
}));

vi.mock("@/lib/storage", () => ({
  storeUploadedBytes: vi.fn()
}));

vi.mock("@/lib/payments", () => ({
  updatePaymentForViewer: vi.fn()
}));

vi.mock("@/lib/invoice-pdf", () => ({
  renderInvoicePdf: vi.fn(),
  buildInvoicePlainText: vi.fn()
}));

vi.mock("@/lib/notification-service", () => ({
  emitNotificationSeedForUser: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {}
}));

import { syncInvoiceReminderTouchpointsForViewer } from "@/lib/invoices";

function addDaysIso(start: string, days: number) {
  const date = new Date(start);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

describe("invoice reminder scheduling", () => {
  const viewer = {
    id: "viewer-1",
    displayName: "Creator",
    email: "creator@example.com",
    mode: "demo"
  } as const;

  beforeEach(() => {
    repositoryMock.getDealAggregate.mockReset();
    repositoryMock.listInvoiceReminderTouchpoints.mockReset();
    repositoryMock.updateInvoiceReminderTouchpoint.mockReset();
    repositoryMock.upsertInvoiceReminderTouchpoints.mockReset();
  });

  it("schedules send reminders from the finalized invoice date when a PDF exists but the invoice is unsent", async () => {
    const finalizedAt = "2026-04-10T15:24:00.000Z";
    const anchorDate = new Date(finalizedAt);
    anchorDate.setHours(0, 0, 0, 0);
    const expectedAnchorDate = anchorDate.toISOString();

    repositoryMock.getDealAggregate.mockResolvedValue({
      deal: {
        id: "deal-1",
        brandName: "Nimbus",
        campaignName: "Spring Drop"
      },
      terms: {
        deliverables: [],
        campaignDateWindow: null
      },
      documents: [],
      invoiceRecord: {
        status: "finalized",
        pdfDocumentId: "pdf-1",
        sentAt: null,
        finalizedAt,
        draftSavedAt: null,
        updatedAt: finalizedAt
      }
    });
    repositoryMock.upsertInvoiceReminderTouchpoints.mockResolvedValue([
      {
        id: "touchpoint-1"
      }
    ]);

    await syncInvoiceReminderTouchpointsForViewer(viewer, "deal-1");

    expect(repositoryMock.upsertInvoiceReminderTouchpoints).toHaveBeenCalledWith(
      viewer.id,
      "deal-1",
      [
        {
          anchorDate: expectedAnchorDate,
          offsetDays: 0,
          sendOn: expectedAnchorDate,
          status: "pending",
          notificationId: null
        },
        {
          anchorDate: expectedAnchorDate,
          offsetDays: 1,
          sendOn: addDaysIso(expectedAnchorDate, 1),
          status: "pending",
          notificationId: null
        },
        {
          anchorDate: expectedAnchorDate,
          offsetDays: 3,
          sendOn: addDaysIso(expectedAnchorDate, 3),
          status: "pending",
          notificationId: null
        }
      ]
    );
  });

  it("cancels pending reminder touchpoints when no invoice or date anchor remains", async () => {
    repositoryMock.getDealAggregate.mockResolvedValue({
      deal: {
        id: "deal-1",
        brandName: "Nimbus",
        campaignName: "Spring Drop"
      },
      terms: {
        deliverables: [],
        campaignDateWindow: null
      },
      documents: [],
      invoiceRecord: null
    });
    repositoryMock.listInvoiceReminderTouchpoints.mockResolvedValue([
      {
        id: "pending-touchpoint",
        status: "pending"
      },
      {
        id: "sent-touchpoint",
        status: "sent"
      }
    ]);

    const result = await syncInvoiceReminderTouchpointsForViewer(viewer, "deal-1");

    expect(repositoryMock.updateInvoiceReminderTouchpoint).toHaveBeenCalledTimes(1);
    expect(repositoryMock.updateInvoiceReminderTouchpoint).toHaveBeenCalledWith(
      "pending-touchpoint",
      {
        status: "cancelled"
      }
    );
    expect(repositoryMock.upsertInvoiceReminderTouchpoints).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
