/**
 * This route handles admin-only HTTP requests.
 * It checks admin access here and then calls the shared admin modules that do the real work.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import {
  deleteUser,
  deleteUserDeal,
  getAdminUserDetail,
  grantUserTrial,
  resetUserOnboarding,
  updateUserPlan
} from "@/lib/admin-dashboard";
import { requireApiAdminViewer } from "@/lib/admin-auth";
import {
  pauseCurrentSubscriptionForViewer,
  resumePausedSubscriptionForViewer
} from "@/lib/billing/service";
import { fail, ok } from "@/lib/http";

type AdminSubscriptionAction =
  | { action: "pause_user" }
  | { action: "resume_user" };

async function handleSubscriptionAction(userId: string, input: AdminSubscriptionAction) {
  const user = await import("@/lib/prisma").then((m) =>
    m.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    })
  );

  if (!user) {
    throw new Error("User not found.");
  }

  const viewer = { id: user.id, email: user.email, displayName: user.displayName, mode: "clerk" as const };

  if (input.action === "pause_user") {
    const result = await pauseCurrentSubscriptionForViewer(viewer);
    return ok({
      message: result.mode === "already_scheduled"
        ? "Subscription was already set to cancel at period end."
        : `Subscription set to cancel at period end.${result.endsAt ? ` Ends: ${new Date(result.endsAt).toLocaleDateString()}.` : ""}`,
    });
  }

  const result = await resumePausedSubscriptionForViewer(viewer);
  return ok({
    message: result.mode === "already_active"
      ? "Subscription is already active."
      : "Subscription resumed successfully.",
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("get_detail")
  }),
  z.object({
    action: z.literal("reset_onboarding")
  }),
  z.object({
    action: z.literal("delete_deal"),
    dealId: z.string().min(1)
  }),
  z.object({
    action: z.literal("delete_user")
  }),
  z.object({
    action: z.literal("pause_user")
  }),
  z.object({
    action: z.literal("resume_user")
  }),
  z.object({
    action: z.literal("update_plan"),
    planTier: z.enum(["free", "basic", "premium"]),
    subscriptionStatus: z.enum(["active", "trialing", "canceled", "paused"])
  }),
  z.object({
    action: z.literal("grant_trial"),
    planTier: z.enum(["basic", "premium"]),
    durationDays: z.number().int().min(1).max(365)
  })
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireApiAdminViewer();
    const { userId } = await context.params;
    const input = actionSchema.parse(await request.json());

    switch (input.action) {
      case "get_detail": {
        const detail = await getAdminUserDetail(userId);
        if (!detail) return fail("User not found.", 404);
        return ok({ detail });
      }

      case "reset_onboarding": {
        await resetUserOnboarding(userId);
        revalidateTag(`user-${userId}-onboarding`, "max");
        revalidateTag(`user-${userId}-profile`, "max");
        revalidatePath("/app", "layout");
        return ok({ message: "Onboarding reset." });
      }

      case "delete_deal": {
        await deleteUserDeal(userId, input.dealId);
        revalidatePath("/app", "layout");
        revalidatePath("/admin");
        return ok({ message: "Workspace deleted." });
      }

      case "delete_user": {
        const result = await deleteUser(userId);
        revalidatePath("/admin");
        return ok({
          message: `User deleted. ${result.deletedFiles} storage files removed.${result.storageErrors.length > 0 ? ` ${result.storageErrors.length} file errors.` : ""}`
        });
      }

      case "pause_user": {
        const result = await handleSubscriptionAction(userId, input);
        revalidatePath("/app", "layout");
        revalidatePath("/admin");
        return result;
      }

      case "resume_user": {
        const result = await handleSubscriptionAction(userId, input);
        revalidatePath("/app", "layout");
        revalidatePath("/admin");
        return result;
      }

      case "update_plan": {
        await updateUserPlan(userId, input.planTier, input.subscriptionStatus);
        revalidatePath("/app", "layout");
        return ok({ message: `Plan set to ${input.planTier} (${input.subscriptionStatus}).` });
      }

      case "grant_trial": {
        await grantUserTrial(userId, input.planTier, input.durationDays);
        revalidatePath("/app", "layout");
        return ok({ message: `${input.durationDays}-day ${input.planTier} trial granted.` });
      }
    }
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Action failed.";

    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
