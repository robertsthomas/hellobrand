/**
 * This file syncs Clerk signup and waitlist contacts into Resend audience segments.
 * It keeps contact creation idempotent so webhook retries do not block signup handling.
 */
import { createResendClient } from "@/lib/resend-client";

type ResendSegmentKind = "users" | "waitlist";

type AddResendAudienceContactInput = {
  kind: ResendSegmentKind;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  source: string;
  userId?: string | null;
};

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined) {
  return normalizeString(value)?.toLowerCase() ?? null;
}

function getUsersAudienceId() {
  return (
    normalizeString(process.env.RESEND_USERS_SEGMENT_ID) ??
    normalizeString(process.env.RESEND_USERS_AUDIENCE_ID) ??
    normalizeString(process.env.RESEND_AUDIENCE_ID)
  );
}

function getWaitlistAudienceId() {
  return (
    normalizeString(process.env.RESEND_WAITLIST_SEGMENT_ID) ??
    normalizeString(process.env.RESEND_WAITLIST_AUDIENCE_ID)
  );
}

function getSegmentId(kind: ResendSegmentKind) {
  return kind === "users" ? getUsersAudienceId() : getWaitlistAudienceId();
}

function isDuplicateContactError(error: { message: string; statusCode: number | null }) {
  const message = error.message.toLowerCase();
  return error.statusCode === 409 || message.includes("already exists");
}

export async function addResendAudienceContact(input: AddResendAudienceContactInput) {
  const email = normalizeEmail(input.email);
  if (!email) {
    return { status: "skipped" as const, reason: "missing_email" as const };
  }

  const segmentId = getSegmentId(input.kind);
  if (!segmentId) {
    return { status: "skipped" as const, reason: "missing_segment_id" as const };
  }

  const apiKey = normalizeString(process.env.RESEND_API_KEY);
  if (!apiKey) {
    return { status: "skipped" as const, reason: "missing_api_key" as const };
  }

  const resend = await createResendClient(apiKey);
  const response = await resend.contacts.create({
    email,
    firstName: normalizeString(input.firstName) ?? undefined,
    lastName: normalizeString(input.lastName) ?? undefined,
    unsubscribed: false,
    segments: [{ id: segmentId }],
    properties: {
      source: input.source,
      user_id: normalizeString(input.userId),
    },
  });

  if (response.error) {
    if (isDuplicateContactError(response.error)) {
      return { status: "exists" as const, email, segmentId };
    }

    throw new Error(`Failed to add Resend contact: ${response.error.message}`);
  }

  return {
    status: "created" as const,
    email,
    segmentId,
    contactId: response.data.id,
  };
}
