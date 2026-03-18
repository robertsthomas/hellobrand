import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { findDuplicateDeals } from "@/lib/duplicate-detection";
import { getIntakeSessionForViewer } from "@/lib/intake";
import { fail, ok } from "@/lib/http";
import { getRepository } from "@/lib/repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    const { sessionId } = await params;

    const { session } = await getIntakeSessionForViewer(viewer, sessionId);
    const dealId = session.dealId;

    const repository = getRepository();
    const docs = await repository.listDocuments(viewer.id, dealId);

    const rawTexts: string[] = [];
    const fileNames: string[] = [];

    for (const doc of docs) {
      const text = doc.normalizedText ?? doc.rawText;
      if (text?.trim()) {
        rawTexts.push(text);
        fileNames.push(doc.fileName);
      }
    }

    if (rawTexts.length === 0) {
      return ok({ matches: [] });
    }

    const allMatches = await findDuplicateDeals(viewer.id, { rawTexts, fileNames });
    const matches = allMatches.filter((m) => m.dealId !== dealId);

    return ok({ matches });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not check for duplicates.";
    return fail(message, 500);
  }
}
