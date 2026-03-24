import { inngest } from "@/lib/inngest/client";
import { processDocumentById } from "@/lib/deals";

export const processContractFunction = inngest.createFunction(
  { id: "process-deal-document" },
  { event: "documents/process.requested" },
  async ({ event, step }) => {
    const documentId = String(event.data.documentId ?? "");

    if (!documentId) {
      throw new Error("Missing documentId.");
    }

    const aggregate = await step.run("process-document", async () =>
      processDocumentById(documentId)
    );

    return {
      ok: true,
      documentId,
      dealId: aggregate?.deal.id ?? null
    };
  }
);

export const checkWorkspaceDuplicatesFunction = inngest.createFunction(
  { id: "check-workspace-duplicates" },
  { event: "workspace/check-duplicates.requested" },
  async ({ event, step }) => {
    const dealId = String(event.data.dealId ?? "");
    const userId = String(event.data.userId ?? "");
    const sessionId = String(event.data.sessionId ?? "");

    if (!dealId || !userId || !sessionId) {
      throw new Error("Missing dealId, userId, or sessionId.");
    }

    await step.run("mark-checking", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { emitWorkspaceNotificationForSession } = await import(
        "@/lib/notification-service"
      );
      await prisma.intakeSession.update({
        where: { id: sessionId },
        data: { duplicateCheckStatus: "checking" }
      });
      await emitWorkspaceNotificationForSession(
        sessionId,
        "workspace.duplicate_checking"
      );
    });

    const matches = await step.run("find-duplicates", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { findDuplicateDeals } = await import("@/lib/duplicate-detection");

      const documents = await prisma.document.findMany({
        where: { dealId },
        select: { rawText: true, normalizedText: true, fileName: true }
      });

      const rawTexts = documents
        .map((doc) => doc.normalizedText || doc.rawText || "")
        .filter(Boolean);
      const fileNames = documents.map((doc) => doc.fileName).filter(Boolean);

      if (rawTexts.length === 0) {
        return [];
      }

      const allMatches = await findDuplicateDeals(userId, {
        rawTexts,
        fileNames
      });

      // Exclude the current deal from matches
      return allMatches.filter((match) => match.dealId !== dealId);
    });

    await step.run("save-results", async () => {
      const { revalidateTag } = await import("next/cache");
      const {
        emitWorkspaceNotificationForSession,
        supersedeWorkspaceNotificationEvents
      } = await import("@/lib/notification-service");
      const { prisma } = await import("@/lib/prisma");
      await prisma.intakeSession.update({
        where: { id: sessionId },
        data: {
          duplicateCheckStatus: matches.length > 0 ? "duplicates_found" : "clean",
          duplicateMatchJson: matches.length > 0 ? JSON.parse(JSON.stringify(matches)) : undefined
        }
      });

      // Invalidate cached deals so the notification appears on the dashboard
      revalidateTag(`user-${userId}-deals`, "max");
      revalidateTag(`user-${userId}-notifications`, "max");

      if (matches.length > 0) {
        await emitWorkspaceNotificationForSession(
          sessionId,
          "workspace.duplicates_found"
        );
      } else {
        await supersedeWorkspaceNotificationEvents(userId, sessionId, [
          "workspace.duplicate_checking"
        ]);
      }
    });

    return {
      ok: true,
      dealId,
      sessionId,
      duplicatesFound: matches.length
    };
  }
);
