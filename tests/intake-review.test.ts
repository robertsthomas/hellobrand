import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  intakeSession: {
    findFirst: vi.fn(),
    update: vi.fn()
  }
};

const startNextQueuedIntakeSessionForUserMock = vi.fn();
const startQueuedIntakeSessionByIdMock = vi.fn();
const syncIntakeSessionForDealIdMock = vi.fn();
const emitWorkspaceNotificationForCurrentStateMock = vi.fn();
const reprocessDocumentForViewerMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/intake-queue", () => ({
  startNextQueuedIntakeSessionForUser: startNextQueuedIntakeSessionForUserMock,
  startQueuedIntakeSessionById: startQueuedIntakeSessionByIdMock
}));

vi.mock("@/lib/intake-state", () => ({
  syncIntakeSessionForDealId: syncIntakeSessionForDealIdMock
}));

vi.mock("@/lib/notification-service", () => ({
  emitWorkspaceNotificationForCurrentState:
    emitWorkspaceNotificationForCurrentStateMock
}));

vi.mock("@/lib/deals", () => ({
  getDealForViewer: vi.fn(),
  reprocessDocumentForViewer: reprocessDocumentForViewerMock,
  updateDealForViewer: vi.fn(),
  updateTermsForViewer: vi.fn()
}));

vi.mock("@/lib/profile", () => ({
  getProfileForViewer: vi.fn()
}));

vi.mock("@/lib/repository", () => ({
  getRepository: vi.fn(() => ({
    saveSummary: vi.fn()
  }))
}));

vi.mock("@/lib/intake-normalization", () => ({
  createPersistedIntakeRecord: vi.fn()
}));

import {
  retryIntakeSessionForViewer,
  startQueuedIntakeAnalysisForViewer
} from "@/lib/intake";

describe("intake review workflows", () => {
  const viewer = {
    id: "viewer-1",
    displayName: "Creator",
    email: "creator@example.com",
    mode: "demo"
  } as const;

  beforeEach(() => {
    prismaMock.intakeSession.findFirst.mockReset();
    prismaMock.intakeSession.update.mockReset();
    startNextQueuedIntakeSessionForUserMock.mockReset();
    startQueuedIntakeSessionByIdMock.mockReset();
    syncIntakeSessionForDealIdMock.mockReset();
    emitWorkspaceNotificationForCurrentStateMock.mockReset();
    reprocessDocumentForViewerMock.mockReset();
  });

  it("throws when no queued workspaces are ready to analyze", async () => {
    startNextQueuedIntakeSessionForUserMock.mockResolvedValue(null);

    await expect(
      startQueuedIntakeAnalysisForViewer(viewer, {
        sessionIds: ["session-1"]
      })
    ).rejects.toThrow("There are no queued workspaces ready to analyze.");

    expect(startNextQueuedIntakeSessionForUserMock).toHaveBeenCalledWith(
      viewer.id,
      ["session-1"]
    );
  });

  it("retry clears the session error, reprocesses linked documents, and returns the synced session", async () => {
    prismaMock.intakeSession.findFirst.mockResolvedValue({
      id: "session-1",
      userId: viewer.id,
      dealId: "deal-1",
      status: "failed",
      errorMessage: "queue offline",
      documents: [
        {
          documentId: "doc-1",
          document: {
            id: "doc-1"
          }
        },
        {
          documentId: "doc-2",
          document: {
            id: "doc-2"
          }
        }
      ]
    });
    prismaMock.intakeSession.update.mockResolvedValue(null);
    reprocessDocumentForViewerMock.mockResolvedValue(undefined);
    syncIntakeSessionForDealIdMock.mockResolvedValue({
      id: "session-1",
      dealId: "deal-1",
      status: "processing",
      errorMessage: null
    });
    emitWorkspaceNotificationForCurrentStateMock.mockResolvedValue(undefined);

    const result = await retryIntakeSessionForViewer(viewer, "session-1");

    expect(prismaMock.intakeSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: {
        status: "processing",
        errorMessage: null
      }
    });
    expect(reprocessDocumentForViewerMock).toHaveBeenNthCalledWith(
      1,
      viewer,
      "doc-1"
    );
    expect(reprocessDocumentForViewerMock).toHaveBeenNthCalledWith(
      2,
      viewer,
      "doc-2"
    );
    expect(syncIntakeSessionForDealIdMock).toHaveBeenCalledWith("deal-1");
    expect(emitWorkspaceNotificationForCurrentStateMock).toHaveBeenCalledWith(
      "session-1"
    );
    expect(result).toEqual({
      id: "session-1",
      dealId: "deal-1",
      status: "processing",
      errorMessage: null
    });
  });
});
