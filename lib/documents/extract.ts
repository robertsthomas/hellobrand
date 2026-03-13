import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { slugify } from "@/lib/utils";

export class UnreadableDocumentError extends Error {
  constructor(message = "We could not reliably parse this file.") {
    super(message);
    this.name = "UnreadableDocumentError";
  }
}

function normalizeLine(line: string) {
  return line
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[•●▪]/g, "-")
    .trim();
}

export function normalizeDocumentText(value: string) {
  const lines = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(normalizeLine);

  const deduped: string[] = [];
  let previous = "";

  for (const line of lines) {
    if (!line) {
      if (previous !== "") {
        deduped.push("");
      }
      previous = "";
      continue;
    }

    if (line === previous && line.length < 100) {
      continue;
    }

    deduped.push(line);
    previous = line;
  }

  const normalized = deduped.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (normalized.length < 120) {
    throw new UnreadableDocumentError(
      "We could not reliably parse this file. Try a text-based PDF, DOCX, or pasted text instead."
    );
  }

  return normalized;
}

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
) {
  if (
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  ) {
    const result = await pdfParse(buffer);
    return {
      rawText: result.text,
      normalizedText: normalizeDocumentText(result.text)
    };
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      rawText: result.value,
      normalizedText: normalizeDocumentText(result.value)
    };
  }

  if (mimeType === "text/plain" || fileName.toLowerCase().endsWith(".txt")) {
    const rawText = buffer.toString("utf8");
    return {
      rawText,
      normalizedText: normalizeDocumentText(rawText)
    };
  }

  throw new UnreadableDocumentError(
    "Only PDF, DOCX, and pasted text are supported in this beta."
  );
}

export async function persistExtractedText(
  dealId: string,
  fileName: string,
  text: string
) {
  const directory = path.join(process.cwd(), ".runtime", "extracted");
  await mkdir(directory, { recursive: true });
  const outputPath = path.join(
    directory,
    `${dealId}-${slugify(fileName || "document")}.txt`
  );

  await writeFile(outputPath, text, "utf8");
  return outputPath;
}
