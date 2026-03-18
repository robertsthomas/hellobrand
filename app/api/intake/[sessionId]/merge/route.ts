import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { uploadDocumentsForViewer, deleteDealForViewer } from "@/lib/deals";
import { getIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { getRepository } from "@/lib/repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { sessionId } = await params;
    const body = await request.json();
    const targetDealId = body.targetDealId;

    if (typeof targetDealId !== "string" || !targetDealId) {
      return fail("targetDealId is required.", 400);
    }

    const { session } = await getIntakeSessionForViewer(viewer, sessionId);
    const sourceDealId = session.dealId;

    if (sourceDealId === targetDealId) {
      return fail("Cannot merge a deal with itself.", 400);
    }

    const repository = getRepository();

    // Verify target deal exists and belongs to user
    const targetAggregate = await repository.getDealAggregate(viewer.id, targetDealId);
    if (!targetAggregate) {
      return fail("Target workspace not found.", 404);
    }

    // Get source documents
    const sourceDocs = await repository.listDocuments(viewer.id, sourceDealId);

    // Re-upload each source document's text to the target deal
    const pastedTexts: string[] = [];
    for (const doc of sourceDocs) {
      if (doc.sourceType === "pasted_text" && doc.rawText) {
        pastedTexts.push(doc.rawText);
      } else if (doc.rawText || doc.normalizedText) {
        // For file-based docs that have already been extracted,
        // add the text as pasted content to the target deal
        pastedTexts.push(doc.normalizedText ?? doc.rawText ?? "");
      }
    }

    // Upload extracted text to target deal
    if (pastedTexts.length > 0) {
      for (const text of pastedTexts) {
        await uploadDocumentsForViewer(viewer, targetDealId, {
          pastedText: text,
          startProcessing: true
        });
      }
    }

    // Delete the source draft deal
    await deleteDealForViewer(viewer, sourceDealId);

    return ok({
      merged: true,
      targetDealId,
      documentsTransferred: sourceDocs.length
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not merge workspaces.";
    return fail(message, 500);
  }
}
