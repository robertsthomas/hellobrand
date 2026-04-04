"use server";

import { ZodError } from "zod";

import { requireViewer } from "@/lib/auth";
import { createFeedbackSubmission } from "@/lib/feedback";
import { captureHandledError } from "@/lib/monitoring/sentry";
import { feedbackSubmissionSchema } from "@/lib/validation";

export type FeedbackActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  submissionId: string | null;
};

function isNextRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

function normalizeNullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseFeedbackInput(formData: FormData) {
  return feedbackSubmissionSchema.parse({
    score: Number(formData.get("score") ?? NaN),
    message: normalizeNullableString(formData.get("message")),
    pagePath: String(formData.get("pagePath") ?? ""),
    pageTitle: String(formData.get("pageTitle") ?? ""),
    dealId: normalizeNullableString(formData.get("dealId")),
    requestedFollowUp: String(formData.get("requestedFollowUp") ?? "") === "true"
  });
}

export async function submitFeedbackAction(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  try {
    const viewer = await requireViewer();
    const input = parseFeedbackInput(formData);

    const result = await createFeedbackSubmission(viewer, input);

    return {
      status: "success",
      message: input.requestedFollowUp
        ? "Thanks. We'll send you an email so you can add more context."
        : "Thanks for the feedback.",
      submissionId: result.id
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    if (error instanceof ZodError) {
      return {
        status: "error",
        message: error.issues[0]?.message ?? "Please complete the feedback form.",
        submissionId: null
      };
    }

    captureHandledError(error, {
      area: "feedback",
      name: "submit_feedback",
      captureExpected: true
    });

    return {
      status: "error",
      message: "Could not submit feedback right now.",
      submissionId: null
    };
  }
}
