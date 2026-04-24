import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { clerkClientMock, waitlistCreateMock, sendWaitlistConfirmationEmailMock } = vi.hoisted(
  () => ({
    clerkClientMock: vi.fn(),
    waitlistCreateMock: vi.fn(),
    sendWaitlistConfirmationEmailMock: vi.fn(),
  })
);

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: clerkClientMock,
}));

vi.mock("@/lib/waitlist-email", () => ({
  sendWaitlistConfirmationEmail: sendWaitlistConfirmationEmailMock,
}));

import { joinWaitlist } from "@/app/server-actions/waitlist-actions";

describe("waitlist signup trigger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    clerkClientMock.mockResolvedValue({
      waitlistEntries: {
        create: waitlistCreateMock,
      },
    });
    waitlistCreateMock.mockResolvedValue({ id: "wle_123" });
    sendWaitlistConfirmationEmailMock.mockResolvedValue({ id: "email-1" });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("sends the waitlist confirmation after Clerk creates the waitlist entry", async () => {
    const result = await joinWaitlist("creator@example.com");

    expect(result).toEqual({ success: true, error: null });
    expect(waitlistCreateMock).toHaveBeenCalledWith({ emailAddress: "creator@example.com" });
    expect(sendWaitlistConfirmationEmailMock).toHaveBeenCalledWith("creator@example.com", {
      idempotencyKey: "waitlist-confirmation/wle_123",
    });
  });

  it("does not fail the waitlist join when confirmation email sending fails", async () => {
    sendWaitlistConfirmationEmailMock.mockRejectedValue(new Error("Email failed"));

    const result = await joinWaitlist("creator@example.com");

    expect(result).toEqual({ success: true, error: null });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Waitlist confirmation email error:",
      expect.any(Error)
    );
  });
});
