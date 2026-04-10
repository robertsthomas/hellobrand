/**
 * This route handles local development reset behavior.
 * It exists as a dev-only boundary so that reset logic does not leak into normal product routes.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/http";
import {
  clearClerkUsers,
  clearDevelopmentDatabase,
  getDevDashboardViewerFromSession,
  isLocalDevelopmentRequest,
  resetViewerGuideState,
  resetViewerOnboardingState
} from "@/lib/dev-dashboard";

const requestSchema = z.object({
  action: z.enum([
    "reset_onboarding",
    "reset_guide",
    "clear_database",
    "clear_users",
    "clear_both"
  ])
});

function invalidateViewerState(userId: string) {
  revalidateTag(`user-${userId}-deals`, "max");
  revalidateTag(`user-${userId}-profile`, "max");
  revalidateTag(`user-${userId}-onboarding`, "max");
  revalidatePath("/app", "layout");
  revalidatePath("/dev");
}

export async function POST(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) {
    return fail("Not found.", 404);
  }

  const viewer = await getDevDashboardViewerFromSession();

  if (!viewer) {
    return fail("Unauthorized", 401);
  }

  try {
    const { action } = requestSchema.parse(await request.json());

    if (action === "reset_onboarding") {
      const result = await resetViewerOnboardingState(viewer.id);
      invalidateViewerState(viewer.id);

      return ok({
        message: result.changed
          ? "Onboarding state reset for the current user."
          : "No onboarding state was found for the current user."
      });
    }

    if (action === "reset_guide") {
      const result = await resetViewerGuideState(viewer.id);
      invalidateViewerState(viewer.id);

      return ok({
        message: result.changed
          ? "Tooltip and guide progress reset for the current user."
          : "Could not reset tooltip and guide progress."
      });
    }

    if (action === "clear_database") {
      const result = await clearDevelopmentDatabase();
      invalidateViewerState(viewer.id);

      return ok({
        message: result.cleared
          ? "Development database cleared."
          : "Database reset skipped because DATABASE_URL is not configured.",
        result
      });
    }

    if (action === "clear_users") {
      const result = await clearClerkUsers(viewer.id);

      return ok({
        message: `Deleted ${result.deletedCount} Clerk user${result.deletedCount === 1 ? "" : "s"}.`,
        result,
        redirectToLogin: result.deletedCurrentUser
      });
    }

    const [databaseResult, clerkResult] = await Promise.all([
      clearDevelopmentDatabase(),
      clearClerkUsers(viewer.id)
    ]);

    invalidateViewerState(viewer.id);

    return ok({
      message: "Development database and Clerk users cleared.",
      result: {
        database: databaseResult,
        clerk: clerkResult
      },
      redirectToLogin: clerkResult.deletedCurrentUser
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Could not complete dev reset action.";

    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
