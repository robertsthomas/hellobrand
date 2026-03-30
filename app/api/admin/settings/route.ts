import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireApiAdminViewer } from "@/lib/admin-auth";
import { updateAppSettings } from "@/lib/admin-settings";
import { fail, ok } from "@/lib/http";

const appSettingsSchema = z.object({
  id: z.string().optional(),
  appAccessEnabled: z.boolean(),
  publicSiteEnabled: z.boolean(),
  signUpsEnabled: z.boolean(),
  emailDeliveryEnabled: z.boolean()
});

export async function PATCH(request: Request) {
  try {
    const admin = await requireApiAdminViewer();
    const input = appSettingsSchema.parse(await request.json());
    const settings = await updateAppSettings(
      {
        appAccessEnabled: input.appAccessEnabled,
        publicSiteEnabled: input.publicSiteEnabled,
        signUpsEnabled: input.signUpsEnabled,
        emailDeliveryEnabled: input.emailDeliveryEnabled
      },
      admin.username
    );

    revalidatePath("/");
    revalidatePath("/upload");
    revalidatePath("/sample");
    revalidatePath("/pricing");
    revalidatePath("/login");
    revalidatePath("/app", "layout");
    revalidatePath("/admin");

    return ok({
      settings,
      message: "App settings saved."
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Could not save app settings.";

    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
