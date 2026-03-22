import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import {
  completeProfileOnboarding,
  getOnboardingStateForViewer
} from "@/lib/onboarding";
import { getProfileForViewer } from "@/lib/profile";
import { parseProfileMetadata } from "@/lib/profile-metadata";
import { onboardingProfileSubmitSchema } from "@/lib/validation";

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const [onboardingState, profile] = await Promise.all([
      getOnboardingStateForViewer(viewer),
      getProfileForViewer(viewer)
    ]);

    const { metadata } = parseProfileMetadata(profile.payoutDetails);

    return ok({
      onboardingState,
      prefill: {
        displayName: profile.displayName ?? viewer.displayName,
        contactEmail: profile.contactEmail ?? viewer.email,
        primaryHandle: profile.businessName ?? "",
        socialHandles: metadata.socialHandles
      }
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unauthorized",
      401
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const body = await request.json();
    const input = onboardingProfileSubmitSchema.parse(body);

    const profile = await completeProfileOnboarding(viewer, input);

    return ok({ profile, message: "Onboarding complete." });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? "Invalid input."
        : error instanceof Error
          ? error.message
          : "Could not complete onboarding.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
