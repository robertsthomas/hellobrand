import { revalidatePath, updateTag } from "next/cache";
import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import {
  getProfileForViewer,
  listProfileAuditForViewer,
  updateProfileForViewer
} from "@/lib/profile";
import { profileInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const profile = await getProfileForViewer(viewer);
    const recentChanges = await listProfileAuditForViewer(viewer);
    return ok({ profile, recentChanges });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const input = profileInputSchema.parse(await request.json());
    const profile = await updateProfileForViewer(viewer, input);
    const recentChanges = await listProfileAuditForViewer(viewer);

    updateTag(`user-${viewer.id}-profile`);
    revalidatePath("/app", "layout");

    return ok({ profile, recentChanges, message: "Profile saved." });
  } catch (error) {
    const message = error instanceof ZodError
      ? error.issues[0]?.message ?? "Could not update profile."
      : error instanceof Error
        ? error.message
        : "Could not update profile.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
