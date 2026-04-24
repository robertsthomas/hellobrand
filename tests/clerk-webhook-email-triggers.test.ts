import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyWebhookMock,
  sendWelcomeEmailMock,
  sendWaitlistConfirmationEmailMock,
  addResendAudienceContactMock,
  capturePostHogServerEventMock,
  inngestSendMock,
} = vi.hoisted(() => ({
  verifyWebhookMock: vi.fn(),
  sendWelcomeEmailMock: vi.fn(),
  sendWaitlistConfirmationEmailMock: vi.fn(),
  addResendAudienceContactMock: vi.fn(),
  capturePostHogServerEventMock: vi.fn(),
  inngestSendMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/webhooks", () => ({
  verifyWebhook: verifyWebhookMock,
}));

vi.mock("@/lib/welcome-email", () => ({
  sendWelcomeEmail: sendWelcomeEmailMock,
}));

vi.mock("@/lib/waitlist-email", () => ({
  sendWaitlistConfirmationEmail: sendWaitlistConfirmationEmailMock,
}));

vi.mock("@/lib/resend-audience", () => ({
  addResendAudienceContact: addResendAudienceContactMock,
}));

vi.mock("@/lib/posthog/server", () => ({
  capturePostHogServerEvent: capturePostHogServerEventMock,
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
  },
}));

import { POST } from "@/app/api/webhooks/clerk/route";

function buildRequest() {
  return new Request("https://hellobrand.test/api/webhooks/clerk", {
    method: "POST",
    body: "{}",
  }) as never;
}

describe("Clerk webhook email triggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INNGEST_EVENT_KEY;
    sendWelcomeEmailMock.mockResolvedValue({ id: "welcome-email-1" });
    sendWaitlistConfirmationEmailMock.mockResolvedValue({ id: "waitlist-email-1" });
    addResendAudienceContactMock.mockResolvedValue({ status: "created" });
    capturePostHogServerEventMock.mockResolvedValue(true);
  });

  it("sends welcome email when Clerk creates a user", async () => {
    verifyWebhookMock.mockResolvedValue({
      type: "user.created",
      data: {
        id: "user_123",
        first_name: "Taylor",
        last_name: "Roberts",
        locale: "en-US",
        primary_email_address_id: "email_123",
        email_addresses: [
          {
            id: "email_123",
            email_address: "creator@example.com",
            verification: { status: "verified" },
          },
        ],
      },
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(sendWelcomeEmailMock).toHaveBeenCalledWith({
      userId: "user_123",
      email: "creator@example.com",
      firstName: "Taylor",
      locale: "en-US",
    });
    expect(sendWaitlistConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("sends waitlist confirmation email when Clerk creates a waitlist entry", async () => {
    verifyWebhookMock.mockResolvedValue({
      type: "waitlistEntry.created",
      data: {
        id: "wle_123",
        email_address: "creator@example.com",
      },
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(sendWaitlistConfirmationEmailMock).toHaveBeenCalledWith("creator@example.com", {
      idempotencyKey: "waitlist-confirmation/wle_123",
    });
    expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
  });
});
