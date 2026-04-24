import { beforeEach, describe, expect, it, vi } from "vitest";

const { resendSend } = vi.hoisted(() => ({
  resendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: resendSend,
    },
  })),
}));

import { sendWelcomeEmail } from "@/lib/welcome-email";

describe("welcome email sending", () => {
  beforeEach(() => {
    resendSend.mockReset();
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "HelloBrand <onboarding@hellobrand.com>";
    process.env.RESEND_TEST_TO_EMAIL = "";
  });

  it("sends a welcome email with an idempotency key", async () => {
    resendSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await sendWelcomeEmail({
      userId: "user_123",
      email: "creator@example.com",
      firstName: "Taylor",
    });

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "HelloBrand <onboarding@hellobrand.com>",
        to: ["creator@example.com"],
        subject: "Welcome to HelloBrand",
        text: expect.stringContaining("Hi Taylor,"),
      }),
      { idempotencyKey: "welcome-email/user_123" }
    );
  });

  it("skips sending when Resend is not configured", async () => {
    process.env.RESEND_API_KEY = "";

    const result = await sendWelcomeEmail({
      userId: "user_123",
      email: "creator@example.com",
      firstName: null,
    });

    expect(result).toBeNull();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("respects the resend.dev test recipient guard", async () => {
    process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
    process.env.RESEND_TEST_TO_EMAIL = "owner@example.com";

    const result = await sendWelcomeEmail({
      userId: "user_123",
      email: "creator@example.com",
      firstName: null,
    });

    expect(result).toBeNull();
    expect(resendSend).not.toHaveBeenCalled();
  });
});
