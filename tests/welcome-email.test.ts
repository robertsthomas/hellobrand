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
    process.env.NEXT_PUBLIC_APP_URL = "https://hellobrand.test";
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
        subject: "Hello!",
        react: expect.anything(),
        text: expect.stringContaining("Hi Taylor,"),
      }),
      { idempotencyKey: "welcome-email/user_123" }
    );

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(
          /Start by uploading a brand document[\s\S]*A plain-English summary of the partnership[\s\S]*https:\/\/hellobrand\.test\/app\/intake\/new/
        ),
      }),
      { idempotencyKey: "welcome-email/user_123" }
    );
  });

  it("normalizes BCP-47 locales to the app-supported email locale", async () => {
    resendSend.mockResolvedValue({ data: { id: "email-2" }, error: null });

    await sendWelcomeEmail({
      userId: "user_456",
      email: "creator@example.com",
      firstName: "Taylor",
      locale: "es-ES",
    });

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(
          /Hola Taylor,[\s\S]*Empieza subiendo un documento de marca[\s\S]*Un resumen en lenguaje claro[\s\S]*https:\/\/hellobrand\.test\/app\/intake\/new/
        ),
      }),
      { idempotencyKey: "welcome-email/user_456" }
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
