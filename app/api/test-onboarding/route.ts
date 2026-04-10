/**
 * This route handles onboarding test helpers.
 * It keeps test-only onboarding behavior isolated from the production onboarding flow.
 */
import { fail, ok } from "@/lib/http";
import { isE2EAuthEnabled } from "@/lib/e2e-auth";
import {
  completeFallbackOnboardingStateCookie,
  resetFallbackOnboardingStateCookie
} from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

type Payload = {
  secret?: string;
  userId?: string;
  action?: "reset" | "complete";
};

export async function POST(request: Request) {
  if (!isE2EAuthEnabled()) {
    return fail("Not found.", 404);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return fail("Invalid request body.", 400);
  }

  if (payload.secret !== process.env.HELLOBRAND_E2E_AUTH_SECRET) {
    return fail("Invalid test auth secret.", 401);
  }

  const userId = payload.userId?.trim() || "demo-user";
  const action = payload.action ?? "reset";
  const viewer = {
    id: userId,
    email: `${userId}@hellobrand.app`,
    displayName: "Demo Creator",
    mode: "demo" as const
  };

  if (!process.env.DATABASE_URL) {
    if (action === "reset") {
      await resetFallbackOnboardingStateCookie(viewer);
      return ok({ message: "Onboarding state reset.", userId });
    }

    if (action === "complete") {
      await completeFallbackOnboardingStateCookie(viewer);
      return ok({ message: "Onboarding marked complete.", userId });
    }

    return fail("Invalid action.", 400);
  }

  if (action === "reset") {
    await prisma.userOnboardingState.deleteMany({
      where: { userId }
    });
    return ok({ message: "Onboarding state reset.", userId });
  }

  if (action === "complete") {
    await prisma.userOnboardingState.upsert({
      where: { userId },
      update: {
        profileOnboardingCompletedAt: new Date(),
        profileOnboardingVersion: 1
      },
      create: {
        userId,
        profileOnboardingCompletedAt: new Date(),
        profileOnboardingVersion: 1
      }
    });
    return ok({ message: "Onboarding marked complete.", userId });
  }

  return fail("Invalid action.", 400);
}
