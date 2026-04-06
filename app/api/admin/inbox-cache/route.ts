import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireApiAdminViewer } from "@/lib/admin-auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const INBOX_AI_TASK_KEYS = [
  "email_summary",
  "email_draft",
  "email_suggestions",
  "email_action_items"
] as const;

const cacheTargetSchema = z.enum([
  "inbox",
  "dashboard",
  "payments",
  "analytics",
  "notifications",
  "settings"
]);

const clearCacheSchema = z.object({
  targets: z.array(cacheTargetSchema).min(1)
});

export async function POST(request: Request) {
  try {
    await requireApiAdminViewer();
    const input = clearCacheSchema.parse(await request.json());
    const targets = new Set(input.targets);

    let cleared = {
      threadSummaries: 0,
      previewStates: 0,
      aiCacheEntries: 0
    };

    if (targets.has("inbox")) {
      const [threadSummaries, previewStates, aiCacheEntries] = await prisma.$transaction([
        prisma.emailThread.updateMany({
          where: {
            OR: [
              { aiSummary: { not: null } },
              { aiSummaryUpdatedAt: { not: null } }
            ]
          },
          data: {
            aiSummary: null,
            aiSummaryUpdatedAt: null
          }
        }),
        prisma.emailThreadPreviewState.deleteMany({}),
        prisma.aiCacheEntry.deleteMany({
          where: {
            taskKey: {
              in: [...INBOX_AI_TASK_KEYS]
            }
          }
        })
      ]);

      cleared = {
        threadSummaries: threadSummaries.count,
        previewStates: previewStates.count,
        aiCacheEntries: aiCacheEntries.count
      };

      revalidatePath("/app/inbox");
    }

    if (targets.has("dashboard")) {
      revalidatePath("/app");
      revalidatePath("/app/dashboard");
    }

    if (targets.has("payments")) {
      revalidatePath("/app/payments");
    }

    if (targets.has("analytics")) {
      revalidatePath("/app/analytics");
    }

    if (targets.has("notifications")) {
      revalidatePath("/app/notifications");
    }

    if (targets.has("settings")) {
      revalidatePath("/app/settings");
    }

    return ok({
      message: "Selected caches cleared.",
      targets: [...targets],
      cleared
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Could not clear caches.";

    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
