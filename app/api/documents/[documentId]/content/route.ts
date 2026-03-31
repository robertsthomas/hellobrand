import { NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getRepository } from "@/lib/repository";
import { readStoredBytes } from "@/lib/storage";

function attachmentDisposition(fileName: string, mode: "inline" | "attachment") {
  const sanitized = fileName.replace(/[\r\n"]/g, "-");
  return `${mode}; filename="${sanitized}"`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const viewer = await requireApiViewer();
  const { documentId } = await context.params;
  const { searchParams } = new URL(request.url);
  const dispositionMode = searchParams.get("download") === "1" ? "attachment" : "inline";

  const document = await getRepository().getDocument(documentId);

  if (!document || document.userId !== viewer.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (document.sourceType === "pasted_text") {
    const body = document.normalizedText ?? document.rawText ?? "";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": attachmentDisposition(document.fileName, dispositionMode)
      }
    });
  }

  const bytes = await readStoredBytes(document.storagePath);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": document.mimeType || "application/octet-stream",
      "content-disposition": attachmentDisposition(document.fileName, dispositionMode)
    }
  });
}
