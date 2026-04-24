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

import { sendWaitlistConfirmationEmail } from "@/lib/waitlist-email";

describe("waitlist confirmation email", () => {
  beforeEach(() => {
    resendSend.mockReset();
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = "test-email-token-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://hellobrand.test";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "HelloBrand <updates@hellobrand.com>";
  });

  it("sends the React email, plain text, and unsubscribe headers", async () => {
    resendSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await sendWaitlistConfirmationEmail("creator@example.com");

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "HelloBrand <updates@hellobrand.com>",
        to: ["creator@example.com"],
        subject: "You're on the HelloBrand waitlist!",
        react: expect.anything(),
        text: expect.stringContaining("Thanks for joining the HelloBrand waitlist."),
        headers: expect.objectContaining({
          "List-Unsubscribe": expect.stringContaining(
            "https://hellobrand.test/api/email/unsubscribe?token="
          ),
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }),
      })
    );

    expect(resendSend.mock.calls[0][0].text).toContain(
      "https://hellobrand.test/api/email/unsubscribe?token="
    );
  });

  it("passes an idempotency key when provided by the trigger stage", async () => {
    resendSend.mockResolvedValue({ data: { id: "email-2" }, error: null });

    await sendWaitlistConfirmationEmail("creator@example.com", {
      idempotencyKey: "waitlist-confirmation/wle_123",
    });

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["creator@example.com"],
        react: expect.anything(),
        text: expect.stringContaining("Thanks for joining the HelloBrand waitlist."),
      }),
      { idempotencyKey: "waitlist-confirmation/wle_123" }
    );
  });

  it("skips sending when Resend is not configured", async () => {
    process.env.RESEND_API_KEY = "";

    const result = await sendWaitlistConfirmationEmail("creator@example.com");

    expect(result).toBeNull();
    expect(resendSend).not.toHaveBeenCalled();
  });
});
