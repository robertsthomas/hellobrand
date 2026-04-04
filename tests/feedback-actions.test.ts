import { beforeEach, describe, expect, it, vi } from "vitest";

type FeedbackRecord = {
  id: string;
  userId: string;
  score: number;
  message: string | null;
  pagePath: string;
  pageTitle: string;
  dealId: string | null;
  requestedFollowUp: boolean;
  contactEmail: string;
  userFollowUpEmailMessageId: string | null;
  userFollowUpEmailSentAt: Date | null;
  supportEmailMessageId: string | null;
  supportEmailSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const {
  feedbackRecords,
  prismaMock,
  requireViewerMock,
  getProfileForViewerMock,
  getNotificationEmailConfigMock,
  canSendNotificationEmailInCurrentModeMock,
  resendSend,
  capturePostHogServerEventMock,
  captureHandledErrorMock
} = vi.hoisted(() => {
  const feedbackRecords = new Map<string, FeedbackRecord>();
  const requireViewerMock = vi.fn();
  const getProfileForViewerMock = vi.fn();
  const getNotificationEmailConfigMock = vi.fn();
  const canSendNotificationEmailInCurrentModeMock = vi.fn();
  const resendSend = vi.fn();
  const capturePostHogServerEventMock = vi.fn();
  const captureHandledErrorMock = vi.fn();

  const prismaMock = {
    feedbackSubmission: {
      create: vi.fn(async ({ data }: { data: Omit<FeedbackRecord, "id" | "createdAt" | "updatedAt" | "userFollowUpEmailMessageId" | "userFollowUpEmailSentAt" | "supportEmailMessageId" | "supportEmailSentAt"> }) => {
        const record: FeedbackRecord = {
          id: `feedback-${feedbackRecords.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          userFollowUpEmailMessageId: null,
          userFollowUpEmailSentAt: null,
          supportEmailMessageId: null,
          supportEmailSentAt: null,
          ...data
        };
        feedbackRecords.set(record.id, record);
        return {
          ...record,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FeedbackRecord> }) => {
        const existing = feedbackRecords.get(where.id);
        if (!existing) {
          throw new Error("Feedback submission not found");
        }

        const updated: FeedbackRecord = {
          ...existing,
          ...data,
          updatedAt: new Date()
        };
        feedbackRecords.set(updated.id, updated);
        return {
          ...updated,
          createdAt: new Date(updated.createdAt),
          updatedAt: new Date(updated.updatedAt)
        };
      })
    }
  };

  return {
    feedbackRecords,
    prismaMock,
    requireViewerMock,
    getProfileForViewerMock,
    getNotificationEmailConfigMock,
    canSendNotificationEmailInCurrentModeMock,
    resendSend,
    capturePostHogServerEventMock,
    captureHandledErrorMock
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/auth", () => ({
  requireViewer: requireViewerMock
}));

vi.mock("@/lib/profile", () => ({
  getProfileForViewer: getProfileForViewerMock
}));

vi.mock("@/lib/notification-email", () => ({
  getNotificationEmailConfig: getNotificationEmailConfigMock,
  canSendNotificationEmailInCurrentMode: canSendNotificationEmailInCurrentModeMock
}));

vi.mock("@/lib/posthog/server", () => ({
  capturePostHogServerEvent: capturePostHogServerEventMock
}));

vi.mock("@/lib/monitoring/sentry", () => ({
  captureHandledError: captureHandledErrorMock
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: resendSend
    }
  }))
}));

import { submitFeedbackAction } from "@/app/server-actions/feedback-actions";

const INITIAL_STATE = {
  status: "idle" as const,
  message: null,
  submissionId: null
};

function buildFormData(input?: Partial<{
  score: string;
  message: string;
  pagePath: string;
  pageTitle: string;
  dealId: string;
  requestedFollowUp: boolean;
}>) {
  const formData = new FormData();
  formData.set("score", input?.score ?? "4");
  formData.set("message", input?.message ?? "Helpful product flow.");
  formData.set("pagePath", input?.pagePath ?? "/app");
  formData.set("pageTitle", input?.pageTitle ?? "Dashboard");
  formData.set("dealId", input?.dealId ?? "deal-1");
  formData.set(
    "requestedFollowUp",
    input?.requestedFollowUp ? "true" : "false"
  );
  return formData;
}

describe("submitFeedbackAction", () => {
  beforeEach(() => {
    feedbackRecords.clear();
    vi.clearAllMocks();

    requireViewerMock.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      displayName: "Taylor",
      mode: "clerk"
    });
    getProfileForViewerMock.mockResolvedValue({
      contactEmail: "creator@example.com"
    });
    getNotificationEmailConfigMock.mockReturnValue({
      apiKey: "resend-key",
      fromEmail: "team@hellobrand.com",
      testToEmail: null,
      testMode: false
    });
    canSendNotificationEmailInCurrentModeMock.mockReturnValue(true);
    resendSend.mockImplementation(async ({ to }: { to: string[] }) => ({
      data: { id: `email-${to[0]}` },
      error: null
    }));
    capturePostHogServerEventMock.mockResolvedValue(true);
  });

  it("rejects unauthenticated submissions", async () => {
    requireViewerMock.mockRejectedValue({
      digest: "NEXT_REDIRECT;/login"
    });

    await expect(
      submitFeedbackAction(INITIAL_STATE, buildFormData())
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });
  });

  it("validates score and message limits", async () => {
    const invalidScoreResult = await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({ score: "" })
    );

    expect(invalidScoreResult.status).toBe("error");

    const invalidMessageResult = await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({ message: "x".repeat(2001) })
    );

    expect(invalidMessageResult.status).toBe("error");
    expect(feedbackRecords.size).toBe(0);
  });

  it("persists feedback submissions correctly", async () => {
    const result = await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({
        score: "5",
        message: "Fast and clear.",
        pagePath: "/app/inbox",
        pageTitle: "Inbox",
        dealId: "deal-9"
      })
    );

    expect(result.status).toBe("success");
    expect(feedbackRecords.size).toBe(1);

    const saved = [...feedbackRecords.values()][0];
    expect(saved).toMatchObject({
      userId: "user-1",
      score: 5,
      message: "Fast and clear.",
      pagePath: "/app/inbox",
      pageTitle: "Inbox",
      dealId: "deal-9",
      requestedFollowUp: false,
      contactEmail: "creator@example.com"
    });
  });

  it("only sends user follow-up email when requested", async () => {
    await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({ score: "5", requestedFollowUp: false })
    );

    expect(
      resendSend.mock.calls.some(
        ([payload]) => payload.to?.[0] === "creator@example.com"
      )
    ).toBe(false);

    resendSend.mockClear();

    await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({ score: "5", requestedFollowUp: true })
    );

    expect(
      resendSend.mock.calls.some(
        ([payload]) => payload.to?.[0] === "creator@example.com"
      )
    ).toBe(true);
  });

  it("sends internal support email for low scores and follow-up requests", async () => {
    await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({ score: "2", requestedFollowUp: false })
    );

    expect(
      resendSend.mock.calls.some(
        ([payload]) => payload.to?.[0] === "support@hellobrand.com"
      )
    ).toBe(true);

    resendSend.mockClear();

    await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({ score: "5", requestedFollowUp: true })
    );

    expect(
      resendSend.mock.calls.filter(
        ([payload]) => payload.to?.[0] === "support@hellobrand.com"
      )
    ).toHaveLength(1);
  });

  it("emits a server-side PostHog event without raw feedback text", async () => {
    await submitFeedbackAction(
      INITIAL_STATE,
      buildFormData({
        score: "3",
        message: "This page felt confusing in the middle."
      })
    );

    expect(capturePostHogServerEventMock).toHaveBeenCalledTimes(1);
    expect(capturePostHogServerEventMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "feedback_submitted",
      properties: expect.objectContaining({
        score: 3,
        pagePath: "/app",
        pageGroup: "dashboard",
        requestedFollowUp: false,
        messageProvided: true
      })
    });

    const properties = capturePostHogServerEventMock.mock.calls[0][0].properties;
    expect(properties).not.toHaveProperty("message");
    expect(properties).not.toHaveProperty("messageText");
  });
});
