/**
 * This route handles admin-only HTTP requests.
 * It checks admin access here and then calls the shared admin modules that do the real work.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { updateAdminManagedUser } from "@/lib/admin-dashboard";
import { requireApiAdminViewer } from "@/lib/admin-auth";
import { fail, ok } from "@/lib/http";

const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1),
  creatorLegalName: z.string().optional().nullable(),
  businessName: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  conflictAlertsEnabled: z.boolean(),
  paymentRemindersEnabled: z.boolean(),
  emailNotificationsEnabled: z.boolean()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireApiAdminViewer();
    const { userId } = await context.params;
    const input = userUpdateSchema.parse(await request.json());
    const user = await updateAdminManagedUser(
      userId,
      {
        displayName: input.displayName,
        creatorLegalName: input.creatorLegalName ?? null,
        businessName: input.businessName ?? null,
        contactEmail: input.contactEmail ?? null,
        conflictAlertsEnabled: input.conflictAlertsEnabled,
        paymentRemindersEnabled: input.paymentRemindersEnabled,
        emailNotificationsEnabled: input.emailNotificationsEnabled
      },
      admin.username
    );

    revalidateTag(`user-${userId}-profile`, "max");
    revalidateTag(`user-${userId}-onboarding`, "max");
    revalidatePath("/app", "layout");
    revalidatePath("/admin");

    return ok({
      user,
      message: "User saved."
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Could not save user.";

    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
