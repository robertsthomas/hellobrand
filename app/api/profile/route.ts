import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getProfileForViewer, updateProfileForViewer } from "@/lib/profile";
import { profileInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const profile = await getProfileForViewer(viewer);
    return ok({ profile });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const input = profileInputSchema.parse(await request.json());
    const profile = await updateProfileForViewer(viewer, input);
    return ok({ profile });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update profile.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
