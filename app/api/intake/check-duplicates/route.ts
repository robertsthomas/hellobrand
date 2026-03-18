import { NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth";
import { findDuplicateDeals } from "@/lib/duplicate-detection";
import { extractDocumentText, normalizeDocumentText } from "@/lib/documents/extract";

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const formData = await request.formData();
    const rawTexts: string[] = [];
    const fileNames: string[] = [];

    const pastedText = formData.get("pastedText");
    if (typeof pastedText === "string" && pastedText.trim()) {
      rawTexts.push(pastedText.trim());
      fileNames.push("pasted-text");
    }

    const files = formData.getAll("documents");
    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;

      try {
        const bytes = Buffer.from(await file.arrayBuffer());
        const { normalizedText } = await extractDocumentText(
          bytes,
          file.type || "application/octet-stream",
          file.name
        );
        if (normalizedText.trim()) {
          rawTexts.push(normalizedText);
          fileNames.push(file.name);
        }
      } catch {
        // Skip files we can't extract text from — they won't contribute to matching
      }
    }

    if (rawTexts.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const matches = await findDuplicateDeals(viewer.id, {
      rawTexts,
      fileNames
    });

    return NextResponse.json({ matches });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not check for duplicates.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
