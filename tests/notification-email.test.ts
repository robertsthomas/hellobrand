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
      timeZone: string | null;
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
        timeZone: string | null;
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
    },
    appSettings: {
      upsert: vi.fn(async () => ({
        id: "primary",
        appAccessEnabled: true,
        publicSiteEnabled: true,
        signUpsEnabled: true,
        emailDeliveryEnabled: true,
        updatedByAdminUsername: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
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
  buildNotificationEmailPayload,
  canSendNotificationEmailInCurrentMode,
  enqueueNotificationEmailDelivery,
  getNotificationEmailLocalSendDelayMs,
  resolveNotificationEmailCopy,
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
        timeZone: null,
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

  it("defers notification emails until 9am in the recipient timezone", () => {
    const delayMs = getNotificationEmailLocalSendDelayMs(
      "America/Los_Angeles",
      new Date("2026-04-02T14:00:00.000Z")
    );

    expect(delayMs).toBe(2 * 60 * 60 * 1000);
  });

  it("does not defer notification emails after 9am in the recipient timezone", () => {
    const delayMs = getNotificationEmailLocalSendDelayMs(
      "America/New_York",
      new Date("2026-04-02T14:00:00.000Z")
    );

    expect(delayMs).toBe(0);
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
          timeZone: null,
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
          timeZone: null,
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
          timeZone: null,
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

describe("notification email copy", () => {
  const EMAIL_ELIGIBLE_EVENT_TYPES = [
    "workspace.ready_for_review",
    "workspace.failed",
    "workspace.missing_payment",
    "workspace.missing_deliverables",
    "workspace.missing_usage_rights",
    "email.resync_required",
    "invoice.generate_prompt"
  ] as const;

  const COPY_FIXTURES: Array<{
    eventType: string;
    title: string;
    body: string;
    expectedSubject: string;
    expectedCtaLabel: string;
  }> = [
    {
      eventType: "workspace.ready_for_review",
      title: "Nimbus workspace is ready for review",
      body: "Your workspace has been analyzed and is ready for review.",
      expectedSubject: "Nimbus workspace is ready for review",
      expectedCtaLabel: "Review workspace"
    },
    {
      eventType: "workspace.failed",
      title: "Nimbus workspace processing failed",
      body: "Something went wrong processing your documents.",
      expectedSubject: "Nimbus workspace could not be processed",
      expectedCtaLabel: "View error details"
    },
    {
      eventType: "workspace.missing_payment",
      title: "Payment amount missing from Summer Campaign 2026",
      body: "Add a payment amount to track your earnings, or upload documents that include payment details.",
      expectedSubject: "Summer Campaign 2026 is missing a payment amount",
      expectedCtaLabel: "Add payment amount"
    },
    {
      eventType: "workspace.missing_deliverables",
      title: "No deliverables found in Summer Campaign 2026",
      body: "Add deliverables so HelloBrand can track due dates and send reminders.",
      expectedSubject: "No deliverables found in Summer Campaign 2026",
      expectedCtaLabel: "Add deliverables"
    },
    {
      eventType: "workspace.missing_usage_rights",
      title: "Usage rights not specified in Summer Campaign 2026",
      body: "Add usage rights to understand what the brand can do with your content.",
      expectedSubject: "Usage rights missing from Summer Campaign 2026",
      expectedCtaLabel: "Add usage rights"
    },
    {
      eventType: "email.resync_required",
      title: "Gmail inbox needs resync",
      body: "We couldn't continue syncing test@gmail.com. Reconnect this inbox to start a fresh sync.",
      expectedSubject: "Your Gmail inbox needs to reconnect",
      expectedCtaLabel: "Reconnect inbox"
    },
    {
      eventType: "invoice.generate_prompt",
      title: "Nimbus invoice is ready to generate",
      body: "Today is the final posting milestone for Summer Campaign. Generate the workspace invoice now.",
      expectedSubject: "Nimbus invoice is ready to generate",
      expectedCtaLabel: "Generate invoice"
    }
  ];

  it.each(COPY_FIXTURES)(
    "generates correct copy for $eventType",
    ({ eventType, title, body, expectedSubject, expectedCtaLabel }) => {
      const copy = resolveNotificationEmailCopy({ eventType, title, body });

      expect(copy.subject).toBe(expectedSubject);
      expect(copy.ctaLabel).toBe(expectedCtaLabel);
      expect(copy.headline).toBe(title);
      expect(copy.body).toBe(body);
    }
  );

  it.each(COPY_FIXTURES)(
    "subject for $eventType is under 60 characters",
    ({ eventType, title, body }) => {
      const copy = resolveNotificationEmailCopy({ eventType, title, body });
      expect(copy.subject.length).toBeLessThanOrEqual(60);
    }
  );

  it("truncates long entity names to stay under 60 characters", () => {
    const longBrand = "Amazon Kids Stories with Alexa Extended Edition";
    const copy = resolveNotificationEmailCopy({
      eventType: "workspace.ready_for_review",
      title: `${longBrand} workspace is ready for review`,
      body: "Your workspace has been analyzed and is ready for review."
    });

    expect(copy.subject.length).toBeLessThanOrEqual(60);
    expect(copy.subject).toContain("workspace is ready for review");
  });

  it("does not include the HelloBrand prefix in any subject", () => {
    for (const fixture of COPY_FIXTURES) {
      const copy = resolveNotificationEmailCopy(fixture);
      expect(copy.subject).not.toMatch(/^HelloBrand:/);
    }
  });

  it("returns a non-fallback CTA for every email-eligible event type", () => {
    for (const eventType of EMAIL_ELIGIBLE_EVENT_TYPES) {
      const copy = resolveNotificationEmailCopy({
        eventType,
        title: "Test title",
        body: "Test body"
      });
      expect(copy.ctaLabel).not.toBe("Open in HelloBrand");
    }
  });
});

describe("notification email HTML rendering", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3011";
  });

  it("renders the CTA label in the HTML and plain text", () => {
    const payload = buildNotificationEmailPayload({
      eventType: "workspace.ready_for_review",
      title: "Nimbus workspace is ready for review",
      body: "Your workspace has been analyzed and is ready for review.",
      href: "/app/intake/session-1/review"
    });

    expect(payload.html).toContain("Review workspace");
    expect(payload.text).toContain("Review workspace");
    expect(payload.html).not.toContain("Open in HelloBrand");
  });

  it("does not render the HELLOBRAND header text", () => {
    const payload = buildNotificationEmailPayload({
      eventType: "workspace.ready_for_review",
      title: "Nimbus workspace is ready for review",
      body: "Your workspace has been analyzed and is ready for review.",
      href: "/app/intake/session-1/review"
    });

    expect(payload.html).not.toMatch(
      /text-transform:\s*uppercase[^>]*>HelloBrand<\/p>/
    );
  });

  it("includes a footer with notification settings link", () => {
    const payload = buildNotificationEmailPayload({
      eventType: "workspace.ready_for_review",
      title: "Test",
      body: "Test body",
      href: "/app/intake/session-1/review"
    });

    expect(payload.html).toContain("/app/settings/notifications");
    expect(payload.html).toContain("email notifications enabled");
  });

  it("does not contain em dashes or en dashes", () => {
    const payload = buildNotificationEmailPayload({
      eventType: "workspace.ready_for_review",
      title: "Test workspace is ready for review",
      body: "Your workspace has been analyzed and is ready for review.",
      href: "/app/intake/session-1/review"
    });

    expect(payload.html).not.toContain("\u2013");
    expect(payload.html).not.toContain("\u2014");
    expect(payload.text).not.toContain("\u2013");
    expect(payload.text).not.toContain("\u2014");
  });
});
