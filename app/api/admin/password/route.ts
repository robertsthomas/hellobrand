/**
 * This route handles admin-only HTTP requests.
 * It checks admin access here and then calls the shared admin modules that do the real work.
 */
import { z } from "zod";

import { requireApiAdminViewer, updateAdminCredentialPassword } from "@/lib/admin-auth";
import { fail, ok } from "@/lib/http";

const passwordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
});

export async function PATCH(request: Request) {
  try {
    await requireApiAdminViewer();
    const input = passwordSchema.parse(await request.json());

    if (input.password !== input.confirmPassword) {
      return fail("Passwords do not match.", 400);
    }

    await updateAdminCredentialPassword(input.password);

    return ok({
      message: "Admin password updated."
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Could not update admin password.";

    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
