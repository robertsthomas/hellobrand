import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  startNextQueuedIntakeSessionForUserMock,
  startQueuedIntakeSessionByIdMock,
  syncIntakeSessionForDealIdMock,
  emitWorkspaceNotificationForCurrentStateMock,
  reprocessDocumentForViewerMock,
  getDealForViewerMock,
  updateDealForViewerMock,
  updateTermsForViewerMock,
  getProfileForViewerMock,
  saveSummaryMock,
  createPersistedIntakeRecordMock
} = vi.hoisted(() => ({
  prismaMock: {
    intakeSession: {
      findFirst: vi.fn(),
      update: vi.fn()
    }
  },
  startNextQueuedIntakeSessionForUserMock: vi.fn(),
  startQueuedIntakeSessionByIdMock: vi.fn(),
  syncIntakeSessionForDealIdMock: vi.fn(),
  emitWorkspaceNotificationForCurrentStateMock: vi.fn(),
  reprocessDocumentForViewerMock: vi.fn(),
  getDealForViewerMock: vi.fn(),
  updateDealForViewerMock: vi.fn(),
  updateTermsForViewerMock: vi.fn(),
  getProfileForViewerMock: vi.fn(),
  saveSummaryMock: vi.fn(),
  createPersistedIntakeRecordMock: vi.fn()
}));

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
  getDealForViewer: getDealForViewerMock,
  reprocessDocumentForViewer: reprocessDocumentForViewerMock,
  updateDealForViewer: updateDealForViewerMock,
  updateTermsForViewer: updateTermsForViewerMock
}));

vi.mock("@/lib/profile", () => ({
  getProfileForViewer: getProfileForViewerMock
}));

vi.mock("@/lib/repository", () => ({
  getRepository: vi.fn(() => ({
    saveSummary: saveSummaryMock
  }))
}));

vi.mock("@/lib/intake-normalization", () => ({
  createPersistedIntakeRecord: createPersistedIntakeRecordMock
}));

import {
  confirmIntakeSessionForViewer,
  retryIntakeSessionForViewer,
  startQueuedIntakeAnalysisForViewer
} from "@/lib/intake/review";

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
    getDealForViewerMock.mockReset();
    updateDealForViewerMock.mockReset();
    updateTermsForViewerMock.mockReset();
    getProfileForViewerMock.mockReset();
    saveSummaryMock.mockReset();
    createPersistedIntakeRecordMock.mockReset();
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

  it("clears pending extraction and protects intake-confirmed structured fields on confirmation", async () => {
    prismaMock.intakeSession.findFirst.mockResolvedValue({
      id: "session-1",
      userId: viewer.id,
      dealId: "deal-1",
      status: "ready_for_confirmation",
      completedAt: null
    });
    prismaMock.intakeSession.update.mockResolvedValue(null);
    getProfileForViewerMock.mockResolvedValue(null);
    updateDealForViewerMock.mockResolvedValue(null);
    updateTermsForViewerMock.mockResolvedValue(null);
    createPersistedIntakeRecordMock.mockReturnValue({ body: "{}", version: "intake-normalized:v2" });
    saveSummaryMock.mockResolvedValue(undefined);
    emitWorkspaceNotificationForCurrentStateMock.mockResolvedValue(undefined);

    const aggregate = {
      deal: {
        id: "deal-1",
        brandName: "Dove",
        campaignName: "Dove Partnership",
        confirmedAt: null,
        summary: null
      },
      terms: {
        brandName: "Dove",
        agencyName: null,
        creatorName: "Creator",
        campaignName: "Dove Partnership",
        paymentAmount: null,
        currency: "USD",
        paymentTerms: null,
        paymentStructure: null,
        netTermsDays: null,
        paymentTrigger: null,
        deliverables: [],
        usageRights: null,
        usageRightsOrganicAllowed: null,
        usageRightsPaidAllowed: null,
        whitelistingAllowed: null,
        usageDuration: null,
        usageTerritory: null,
        usageChannels: [],
        exclusivity: null,
        exclusivityApplies: null,
        exclusivityCategory: null,
        exclusivityDuration: null,
        exclusivityRestrictions: null,
        brandCategory: null,
        competitorCategories: [],
        restrictedCategories: [],
        campaignDateWindow: null,
        disclosureObligations: [],
        revisions: null,
        revisionRounds: null,
        termination: null,
        terminationAllowed: null,
        terminationNotice: null,
        terminationConditions: null,
        governingLaw: null,
        notes: null,
        manuallyEditedFields: [],
        briefData: null,
        pendingExtraction: {
          brandCategory: "beauty_personal_care",
          campaignDateWindow: {
            startDate: "2026-07-03",
            endDate: "2026-07-21",
            postingWindow: "July 3 to July 21"
          }
        }
      },
      currentSummary: null
    };
    getDealForViewerMock.mockResolvedValueOnce(aggregate).mockResolvedValueOnce(aggregate);

    await confirmIntakeSessionForViewer(viewer, "session-1", {
      brandName: "Dove",
      contractTitle: "Dove Partnership",
      brandCategory: "beauty_personal_care",
      campaignDateWindow: {
        startDate: "2026-07-03",
        endDate: "2026-07-21",
        postingWindow: "July 3 to July 21"
      },
      deliverables: [],
      timelineItems: [],
      disclosureObligations: [],
      competitorCategories: [],
      restrictedCategories: [],
      analytics: null,
      notes: null
    });

    expect(updateTermsForViewerMock).toHaveBeenCalledWith(
      viewer,
      "deal-1",
      expect.objectContaining({
        brandCategory: "beauty_personal_care",
        campaignDateWindow: {
          startDate: "2026-07-03",
          endDate: "2026-07-21",
          postingWindow: "July 3 to July 21"
        },
        pendingExtraction: null,
        manuallyEditedFields: expect.arrayContaining([
          "deliverables",
          "brandCategory",
          "campaignDateWindow",
          "disclosureObligations",
          "competitorCategories",
          "restrictedCategories"
        ])
      })
    );
  });
});
