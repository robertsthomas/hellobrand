import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  enqueueDocumentProcessingMock,
  emitWorkspaceNotificationForSessionMock,
  safeRevalidateTagMock
} = vi.hoisted(() => ({
  prismaMock: {
    document: {
      findMany: vi.fn()
    },
    intakeSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn()
    }
  },
  enqueueDocumentProcessingMock: vi.fn(),
  emitWorkspaceNotificationForSessionMock: vi.fn(),
  safeRevalidateTagMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/deals", () => ({
  enqueueDocumentProcessing: enqueueDocumentProcessingMock
}));

vi.mock("@/lib/notification-service", () => ({
  emitWorkspaceNotificationForSession: emitWorkspaceNotificationForSessionMock
}));

vi.mock("@/lib/safe-revalidate", () => ({
  safeRevalidateTag: safeRevalidateTagMock
}));

import { startNextQueuedIntakeSessionForUser } from "@/lib/intake-queue";

describe("intake queue", () => {
  const now = new Date("2026-04-25T00:00:00.000Z");

  async function flushBackgroundWork() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  beforeEach(() => {
    prismaMock.document.findMany.mockReset();
    prismaMock.intakeSession.findFirst.mockReset();
    prismaMock.intakeSession.updateMany.mockReset();
    prismaMock.intakeSession.findUnique.mockReset();
    enqueueDocumentProcessingMock.mockReset();
    emitWorkspaceNotificationForSessionMock.mockReset();
    safeRevalidateTagMock.mockReset();
  });

  it("returns the claimed session id without waiting for document enqueue", async () => {
    let resolveEnqueue: (() => void) | null = null;

    prismaMock.intakeSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "session-1",
        userId: "user-1",
        dealId: "deal-1",
        status: "queued",
        errorMessage: null,
        inputSource: "paste",
        draftBrandName: "Brand",
        draftCampaignName: "Campaign",
        draftNotes: null,
        draftPastedText: null,
        draftPastedTextTitle: null,
        duplicateCheckStatus: null,
        duplicateMatchJson: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        expiresAt: null
      });
    prismaMock.intakeSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.intakeSession.findUnique.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      dealId: "deal-1",
      status: "processing",
      errorMessage: null,
      inputSource: "paste",
      draftBrandName: "Brand",
      draftCampaignName: "Campaign",
      draftNotes: null,
      draftPastedText: null,
      draftPastedTextTitle: null,
      duplicateCheckStatus: null,
      duplicateMatchJson: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      expiresAt: null
    });
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: "doc-1"
      }
    ]);
    enqueueDocumentProcessingMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnqueue = () => resolve(undefined);
        })
    );
    emitWorkspaceNotificationForSessionMock.mockResolvedValue(undefined);

    await expect(startNextQueuedIntakeSessionForUser("user-1")).resolves.toMatchObject({
      id: "session-1",
      status: "processing"
    });
    await flushBackgroundWork();

    expect(enqueueDocumentProcessingMock).toHaveBeenCalledWith("doc-1");
    expect(emitWorkspaceNotificationForSessionMock).toHaveBeenCalledWith(
      "session-1",
      "workspace.processing_started"
    );
    expect(safeRevalidateTagMock).toHaveBeenCalledWith("user-user-1-deals");
    expect(safeRevalidateTagMock).toHaveBeenCalledWith("user-user-1-notifications");

    resolveEnqueue?.();
    await Promise.resolve();
  });

  it("swallows background enqueue failures after claiming the session", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    prismaMock.intakeSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "session-2",
        userId: "user-1",
        dealId: "deal-2",
        status: "queued",
        errorMessage: null,
        inputSource: "paste",
        draftBrandName: "Brand",
        draftCampaignName: "Campaign",
        draftNotes: null,
        draftPastedText: null,
        draftPastedTextTitle: null,
        duplicateCheckStatus: null,
        duplicateMatchJson: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        expiresAt: null
      });
    prismaMock.intakeSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.intakeSession.findUnique.mockResolvedValue({
      id: "session-2",
      userId: "user-1",
      dealId: "deal-2",
      status: "processing",
      errorMessage: null,
      inputSource: "paste",
      draftBrandName: "Brand",
      draftCampaignName: "Campaign",
      draftNotes: null,
      draftPastedText: null,
      draftPastedTextTitle: null,
      duplicateCheckStatus: null,
      duplicateMatchJson: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      expiresAt: null
    });
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: "doc-2"
      }
    ]);
    enqueueDocumentProcessingMock.mockRejectedValue(new Error("queue offline"));
    emitWorkspaceNotificationForSessionMock.mockResolvedValue(undefined);

    await expect(startNextQueuedIntakeSessionForUser("user-1")).resolves.toMatchObject({
      id: "session-2",
      status: "processing"
    });
    await flushBackgroundWork();

    expect(errorSpy).toHaveBeenCalledWith(
      "[intake-queue] Could not enqueue pending documents:",
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});
