import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { getRuntimePath } from "@/lib/runtime-path";
import { slugify } from "@/lib/utils";

declare global {
  var pdfjsWorker:
    | {
        WorkerMessageHandler?: unknown;
      }
    | undefined;
}

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

  // Join lines that are part of the same paragraph (PDF line-wrap artifacts).
  // A non-empty line followed by another non-empty line that doesn't start with
  // a bullet, number, heading, or special char is likely a continuation.
  const reflowed: string[] = [];
  for (let i = 0; i < deduped.length; i++) {
    const line = deduped[i];
    const next = deduped[i + 1];

    if (
      line &&
      next &&
      // Current line doesn't end with a sentence terminator or colon
      !/[.!?:;]$/.test(line) &&
      // Next line is not empty
      next.length > 0 &&
      // Next line doesn't look like a new paragraph/section
      !/^[\s•\-–—*\d]/.test(next) &&
      !/^[A-Z][A-Z\s]{3,}/.test(next) && // ALL CAPS heading
      // Current line is reasonably short (PDF column width artifact)
      line.length < 100
    ) {
      reflowed.push(line + " " + next);
      i++; // skip next since we merged it
    } else {
      reflowed.push(line);
    }
  }

  const normalized = reflowed.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (normalized.length < 120) {
    throw new UnreadableDocumentError(
      "We could not reliably parse this file. Try a text-based PDF, DOCX, or pasted text instead."
    );
  }

  return normalized;
}

function pdfJsStandardFontDataUrl() {
  return `${path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "standard_fonts"
  )}/`;
}

let pdfJsMainThreadWorkerPromise: Promise<void> | null = null;

async function ensurePdfJsMainThreadWorker() {
  if (globalThis.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  if (!pdfJsMainThreadWorkerPromise) {
    pdfJsMainThreadWorkerPromise = import("pdfjs-dist/legacy/build/pdf.worker.mjs")
      .then((workerModule) => {
        globalThis.pdfjsWorker = workerModule;
      })
      .catch((error) => {
        pdfJsMainThreadWorkerPromise = null;
        throw error;
      });
  }

  await pdfJsMainThreadWorkerPromise;
}

async function extractPdfTextWithPdfJs(buffer: Buffer) {
  await ensurePdfJsMainThreadWorker();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    stopAtErrors: false,
    isEvalSupported: false,
    standardFontDataUrl: pdfJsStandardFontDataUrl()
  }).promise;

  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLineY: number | null = null;
    let currentLine: string[] = [];

    for (const item of content.items) {
      if (!("str" in item)) {
        continue;
      }

      const text = String(item.str ?? "").trim();
      if (!text) {
        continue;
      }

      const y = Array.isArray(item.transform) ? Number(item.transform[5]) : NaN;

      if (
        currentLine.length > 0 &&
        Number.isFinite(y) &&
        currentLineY !== null &&
        Math.abs(y - currentLineY) > 2
      ) {
        lines.push(currentLine.join(" "));
        currentLine = [];
      }

      currentLine.push(text);
      if (Number.isFinite(y)) {
        currentLineY = y;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "));
    }

    pages.push(lines.join("\n"));
  }

  return pages.join("\n\n");
}

export type ExtractionResult = {
  rawText: string;
  normalizedText: string;
  _debug?: {
    parser: string;
    durationMs: number;
    fileSizeBytes: number;
    extractedChars: number;
  };
  _vendor?: {
    processor: string;
    payload: Record<string, unknown>;
  };
};

export type ExtractDocumentTextOptions = {
  preferDocumentAi?: boolean;
};

async function extractTextWithDocumentAi(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractionResult | null> {
  const lowerFileName = fileName.toLowerCase();

  if (
    mimeType !== "application/pdf" &&
    mimeType !==
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    !lowerFileName.endsWith(".pdf") &&
    !lowerFileName.endsWith(".docx")
  ) {
    return null;
  }

  const {
    hasDocumentAiProcessor,
    processDocumentWithDocumentAi
  } = await import("@/lib/document-ai");

  const processors: Array<"layout" | "ocr"> = [];

  if (
    hasDocumentAiProcessor("layout") &&
    (mimeType === "application/pdf" ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerFileName.endsWith(".pdf") ||
      lowerFileName.endsWith(".docx"))
  ) {
    processors.push("layout");
  }

  if (
    hasDocumentAiProcessor("ocr") &&
    (mimeType === "application/pdf" || lowerFileName.endsWith(".pdf"))
  ) {
    processors.push("ocr");
  }

  if (processors.length === 0) {
    return null;
  }

  const failures: string[] = [];

  for (const processor of processors) {
    const startedAt = Date.now();

    try {
      const response = await processDocumentWithDocumentAi({
        processor,
        bytes: buffer,
        mimeType,
        imagelessMode: true,
        fieldMaskPaths: ["text"]
      });

      if (!response.fullText.trim()) {
        failures.push(`${processor} returned empty text`);
        continue;
      }

      return {
        rawText: response.fullText,
        normalizedText: normalizeDocumentText(response.fullText),
        _debug: {
          parser: `document-ai:${processor}`,
          durationMs: Date.now() - startedAt,
          fileSizeBytes: buffer.length,
          extractedChars: response.fullText.length
        },
        _vendor: {
          processor,
          payload: response.rawResponse
        }
      };
    } catch (error) {
      failures.push(
        `${processor} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new UnreadableDocumentError(failures.join(" | "));
}

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  options?: ExtractDocumentTextOptions
): Promise<ExtractionResult> {
  const startedAt = Date.now();
  const fileSizeBytes = buffer.length;
  const failures: string[] = [];

  function debugMeta(parser: string, text: string) {
    const durationMs = Date.now() - startedAt;
    console.info(`[extract] ${parser} | ${fileName} | ${fileSizeBytes} bytes | ${text.length} chars | ${durationMs}ms`);
    return { parser, durationMs, fileSizeBytes, extractedChars: text.length };
  }

  if (options?.preferDocumentAi) {
    try {
      const result = await extractTextWithDocumentAi(buffer, mimeType, fileName);
      if (result) {
        return result;
      }
    } catch (documentAiError) {
      failures.push(
        documentAiError instanceof Error ? documentAiError.message : String(documentAiError)
      );
    }
  }

  if (
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  ) {
    try {
      const rawText = await extractPdfTextWithPdfJs(buffer);
      return {
        rawText,
        normalizedText: normalizeDocumentText(rawText),
        _debug: debugMeta("pdfjs-dist", rawText)
      };
    } catch (pdfJsError) {
      try {
        const result = await pdfParse(buffer);
        return {
          rawText: result.text,
          normalizedText: normalizeDocumentText(result.text),
          _debug: debugMeta("pdf-parse", result.text)
        };
      } catch (pdfParseError) {
        const messages = [...failures, pdfJsError, pdfParseError]
          .map((error) => (error instanceof Error ? error.message : String(error)))
          .filter(Boolean)
          .join(" | ");

        throw new UnreadableDocumentError(messages || "We could not reliably parse this PDF.");
      }
    }
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      rawText: result.value,
      normalizedText: normalizeDocumentText(result.value),
      _debug: debugMeta("mammoth", result.value)
    };
  }

  if (mimeType === "text/plain" || fileName.toLowerCase().endsWith(".txt")) {
    const rawText = buffer.toString("utf8");
    return {
      rawText,
      normalizedText: normalizeDocumentText(rawText),
      _debug: debugMeta("plaintext", rawText)
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
  const directory = getRuntimePath("extracted");
  await mkdir(directory, { recursive: true });
  const outputPath = path.join(
    directory,
    `${dealId}-${slugify(fileName || "document")}.txt`
  );

  await writeFile(outputPath, text, "utf8");
  return outputPath;
}
