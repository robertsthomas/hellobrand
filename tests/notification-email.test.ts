import { beforeEach, describe, expect, it, vi } from "vitest";

type NotificationRecord = {
  id: string;
  category: string;
  eventType: string;
  status: string;
  title: string;
  body: string;
  href: string;
  userId: string;
  user: {
    email: string;
    profile: {
      id: string;
      contactEmail: string | null;
      emailNotificationsEnabled: boolean;
      createdAt: Date;
    } | null;
  };
};

type DeliveryRecord = {
  id: string;
  appNotificationId: string;
  userId: string;
  recipientEmail: string;
  provider: string;
  providerMessageId: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const {
  notifications,
  deliveries,
  auditEvents,
  inngestSend,
  resendSend,
  prismaMock
} = vi.hoisted(() => {
  type NR = {
    id: string;
    category: string;
    eventType: string;
    status: string;
    title: string;
    body: string;
    href: string;
    userId: string;
    user: {
      email: string;
      profile: {
        id: string;
        contactEmail: string | null;
        emailNotificationsEnabled: boolean;
        createdAt: Date;
      } | null;
    };
  };
  type DR = {
    id: string;
    appNotificationId: string;
    userId: string;
    recipientEmail: string;
    provider: string;
    providerMessageId: string | null;
    status: "pending" | "sent" | "failed" | "skipped";
    errorMessage: string | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  const notifications = new Map<string, NR>();
  const deliveries = new Map<string, DR>();
  const auditEvents = new Map<string, Array<{ changedFields: unknown }>>();
  const inngestSend = vi.fn();
  const resendSend = vi.fn();

  function cloneDelivery(record: DR) {
    return {
      ...record,
      sentAt: record.sentAt ? new Date(record.sentAt) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    };
  }

  const prismaMock = {
    appNotification: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const notification = notifications.get(where.id);
        return notification ? structuredClone(notification) : null;
      })
    },
    notificationEmailDelivery: {
      findUnique: vi.fn(
        async ({
          where,
          include
        }: {
          where: { appNotificationId?: string; id?: string };
          include?: { appNotification?: unknown };
        }) => {
          const delivery =
            where.appNotificationId
              ? deliveries.get(where.appNotificationId)
              : [...deliveries.values()].find((entry) => entry.id === where.id);

          if (!delivery) {
            return null;
          }

          const cloned = cloneDelivery(delivery);
          if (include?.appNotification) {
            return {
              ...cloned,
              appNotification: structuredClone(notifications.get(cloned.appNotificationId) ?? null)
            };
          }

          return cloned;
        }
      ),
      create: vi.fn(
        async ({
          data
        }: {
          data: Pick<
            DR,
            "appNotificationId" | "userId" | "recipientEmail" | "provider" | "status"
          >;
        }) => {
          const record: DR = {
            id: `delivery-${deliveries.size + 1}`,
            providerMessageId: null,
            errorMessage: null,
            sentAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data
          };
          deliveries.set(record.appNotificationId, record);
          return cloneDelivery(record);
        }
      ),
      update: vi.fn(
        async ({
          where,
          data
        }: {
          where: { id: string };
          data: Partial<DR>;
        }) => {
          const existing = [...deliveries.values()].find((entry) => entry.id === where.id);
          if (!existing) {
            throw new Error("Delivery not found");
          }

          const updated: DR = {
            ...existing,
            ...data,
            updatedAt: new Date()
          };
          deliveries.set(updated.appNotificationId, updated);
          return cloneDelivery(updated);
        }
      )
    },
    profileAuditEvent: {
      findMany: vi.fn(async ({ where }: { where: { profileId: string } }) =>
        structuredClone(auditEvents.get(where.profileId) ?? [])
      )
    }
  };

  return { notifications, deliveries, auditEvents, inngestSend, resendSend, prismaMock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: inngestSend
  }
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: resendSend
    }
  }))
}));

import {
  canSendNotificationEmailInCurrentMode,
  enqueueNotificationEmailDelivery,
  resolveNotificationRecipient,
  sendNotificationEmailDelivery
} from "@/lib/notification-email";

function seedWorkspaceNotification(input?: Partial<NotificationRecord>) {
  const notification: NotificationRecord = {
    id: "notification-1",
    category: "workspace",
    eventType: "workspace.ready_for_review",
    status: "active",
    title: "Workspace is ready",
    body: "Your workspace has been analyzed and is ready for review.",
    href: "/app/intake/session-1/review",
    userId: "user-1",
    user: {
      email: "owner@example.com",
      profile: {
        id: "profile-1",
        contactEmail: "owner@example.com",
        emailNotificationsEnabled: true,
        createdAt: new Date("2026-03-30T00:00:00.000Z")
      }
    },
    ...input
  };

  notifications.set(notification.id, notification);
  return notification;
}

describe("notification email helpers", () => {
  it("prefers the profile contact email over the auth email", () => {
    expect(resolveNotificationRecipient("auth@example.com", "creator@example.com")).toBe(
      "creator@example.com"
    );
    expect(resolveNotificationRecipient("auth@example.com", null)).toBe("auth@example.com");
  });

  it("restricts resend.dev sends to the configured test inbox", () => {
    expect(
      canSendNotificationEmailInCurrentMode({
        fromEmail: "onboarding@resend.dev",
        testToEmail: "owner@example.com",
        recipientEmail: "owner@example.com"
      })
    ).toBe(true);

    expect(
      canSendNotificationEmailInCurrentMode({
        fromEmail: "onboarding@resend.dev",
        testToEmail: "owner@example.com",
        recipientEmail: "other@example.com"
      })
    ).toBe(false);
  });
});

describe("notification email queueing", () => {
  beforeEach(() => {
    notifications.clear();
    deliveries.clear();
    auditEvents.clear();
    inngestSend.mockReset();
    resendSend.mockReset();
    prismaMock.appNotification.findUnique.mockClear();
    prismaMock.notificationEmailDelivery.findUnique.mockClear();
    prismaMock.notificationEmailDelivery.create.mockClear();
    prismaMock.notificationEmailDelivery.update.mockClear();
    prismaMock.profileAuditEvent.findMany.mockClear();
    process.env.DATABASE_URL = "postgres://example";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3011";
    process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
    process.env.RESEND_TEST_TO_EMAIL = "owner@example.com";
    process.env.RESEND_API_KEY = "re_test";
    process.env.INNGEST_EVENT_KEY = "event-key";
  });

  it("does not enqueue deliveries when email notifications are explicitly disabled", async () => {
    seedWorkspaceNotification({
      user: {
        email: "owner@example.com",
        profile: {
          id: "profile-1",
          contactEmail: "owner@example.com",
          emailNotificationsEnabled: false,
          createdAt: new Date("2026-03-01T00:00:00.000Z")
        }
      }
    });
    auditEvents.set("profile-1", [{ changedFields: ["emailNotificationsEnabled"] }]);

    const result = await enqueueNotificationEmailDelivery("notification-1");

    expect(result).toBeNull();
    expect(deliveries.size).toBe(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("enqueues deliveries when the user has no profile record yet", async () => {
    seedWorkspaceNotification({
      user: {
        email: "owner@example.com",
        profile: null
      }
    });

    const result = await enqueueNotificationEmailDelivery("notification-1");

    expect(result?.status).toBe("pending");
    expect(deliveries.size).toBe(1);
    expect(inngestSend).toHaveBeenCalledTimes(1);
  });

  it("enqueues deliveries for legacy default-disabled profiles without an explicit opt-out", async () => {
    seedWorkspaceNotification({
      user: {
        email: "owner@example.com",
        profile: {
          id: "profile-1",
          contactEmail: "owner@example.com",
          emailNotificationsEnabled: false,
          createdAt: new Date("2026-03-01T00:00:00.000Z")
        }
      }
    });

    const result = await enqueueNotificationEmailDelivery("notification-1");

    expect(result?.status).toBe("pending");
    expect(deliveries.size).toBe(1);
    expect(inngestSend).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue deliveries for intermediate workspace events", async () => {
    seedWorkspaceNotification({
      eventType: "workspace.processing_started"
    });

    const result = await enqueueNotificationEmailDelivery("notification-1");

    expect(result).toBeNull();
    expect(deliveries.size).toBe(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("dedupes repeated enqueue calls for the same notification", async () => {
    seedWorkspaceNotification();

    const first = await enqueueNotificationEmailDelivery("notification-1");
    const second = await enqueueNotificationEmailDelivery("notification-1");

    expect(first?.status).toBe("pending");
    expect(second?.status).toBe("pending");
    expect(deliveries.size).toBe(1);
    expect(inngestSend).toHaveBeenCalledTimes(1);
  });

  it("queues email deliveries for invoice generation prompts", async () => {
    seedWorkspaceNotification({
      id: "notification-invoice",
      category: "payments",
      eventType: "invoice.generate_prompt",
      title: "Generate the Nimbus invoice",
      body: "Today is the final posting milestone. Generate the invoice now.",
      href: "/app/p/deal-1?tab=invoices"
    });

    const result = await enqueueNotificationEmailDelivery("notification-invoice");

    expect(result?.status).toBe("pending");
    expect(inngestSend).toHaveBeenCalledTimes(1);
  });
});

describe("notification email sending", () => {
  beforeEach(() => {
    notifications.clear();
    deliveries.clear();
    auditEvents.clear();
    inngestSend.mockReset();
    resendSend.mockReset();
    prismaMock.profileAuditEvent.findMany.mockClear();
    process.env.DATABASE_URL = "postgres://example";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3011";
    process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
    process.env.RESEND_TEST_TO_EMAIL = "owner@example.com";
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.INNGEST_EVENT_KEY;
  });

  it("marks a pending delivery as sent when Resend succeeds", async () => {
    seedWorkspaceNotification();
    deliveries.set("notification-1", {
      id: "delivery-1",
      appNotificationId: "notification-1",
      userId: "user-1",
      recipientEmail: "owner@example.com",
      provider: "resend",
      providerMessageId: null,
      status: "pending",
      errorMessage: null,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    resendSend.mockResolvedValue({
      data: { id: "email-123" },
      error: null
    });

    const result = await sendNotificationEmailDelivery("notification-1");

    expect(result?.status).toBe("sent");
    expect(result?.providerMessageId).toBe("email-123");
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  it("marks a delivery as skipped when resend.dev test mode recipient does not match", async () => {
    seedWorkspaceNotification({
      user: {
        email: "owner@example.com",
        profile: {
          id: "profile-1",
          contactEmail: "other@example.com",
          emailNotificationsEnabled: true,
          createdAt: new Date("2026-03-30T00:00:00.000Z")
        }
      }
    });
    deliveries.set("notification-1", {
      id: "delivery-1",
      appNotificationId: "notification-1",
      userId: "user-1",
      recipientEmail: "other@example.com",
      provider: "resend",
      providerMessageId: null,
      status: "pending",
      errorMessage: null,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await sendNotificationEmailDelivery("notification-1");

    expect(result?.status).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("marks an existing delivery as skipped when the notification is no longer an email-eligible event", async () => {
    seedWorkspaceNotification({
      eventType: "workspace.processing_started"
    });
    deliveries.set("notification-1", {
      id: "delivery-1",
      appNotificationId: "notification-1",
      userId: "user-1",
      recipientEmail: "owner@example.com",
      provider: "resend",
      providerMessageId: null,
      status: "pending",
      errorMessage: null,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await sendNotificationEmailDelivery("notification-1");

    expect(result?.status).toBe("skipped");
    expect(result?.errorMessage).toBe("Notification is no longer eligible for email delivery.");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("marks a delivery as failed on terminal Resend errors", async () => {
    seedWorkspaceNotification();
    deliveries.set("notification-1", {
      id: "delivery-1",
      appNotificationId: "notification-1",
      userId: "user-1",
      recipientEmail: "owner@example.com",
      provider: "resend",
      providerMessageId: null,
      status: "pending",
      errorMessage: null,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    resendSend.mockResolvedValue({
      data: null,
      error: {
        message: "Invalid sender",
        statusCode: 403
      }
    });

    const result = await sendNotificationEmailDelivery("notification-1");

    expect(result?.status).toBe("failed");
    expect(result?.errorMessage).toBe("Invalid sender");
  });
});
