import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { updateGuideStep } from "@/lib/onboarding";
import { onboardingGuideUpdateSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const body = await request.json();
    const { stepId, action } = onboardingGuideUpdateSchema.parse(body);

    const guideState = await updateGuideStep(viewer, stepId, action);

    revalidatePath("/app", "layout");

    return ok({ guideState });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? "Invalid input."
        : error instanceof Error
          ? error.message
          : "Could not update guide step.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
