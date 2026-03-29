import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { getRuntimePath } from "@/lib/runtime-path";
import { slugify } from "@/lib/utils";

export class UnreadableDocumentError extends Error {
  constructor(message = "We could not reliably parse this file.") {
    super(message);
    this.name = "UnreadableDocumentError";
  }
}

const LLAMA_PARSE_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
  "csv",
  "rtf",
  "txt",
  "html",
  "htm",
  "xml",
  "eml",
  "msg",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tiff"
]);

function fileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function hasLlamaParseKey() {
  return Boolean(process.env.LLAMA_CLOUD_API_KEY);
}

function shouldTryLlamaParse(mimeType: string, fileName: string) {
  const extension = fileExtension(fileName);
  if (!extension) {
    return false;
  }

  if (mimeType === "text/plain") {
    return false;
  }

  return LLAMA_PARSE_EXTENSIONS.has(extension);
}

function llamaParsePrompt() {
  return [
    "Extract the document into clean markdown while preserving section headings, clause boundaries, lists, dates, tables, and payment or deliverable language.",
    "Do not summarize or omit legal terms.",
    "Keep creator deal structure readable for downstream extraction."
  ].join(" ");
}

function llamaParseTier(): "cost_effective" | "fast" | "agentic" | "agentic_plus" {
  const value = process.env.LLAMA_PARSE_TIER;
  if (
    value === "cost_effective" ||
    value === "fast" ||
    value === "agentic" ||
    value === "agentic_plus"
  ) {
    return value;
  }

  return "cost_effective";
}

function llamaParseVersion() {
  return process.env.LLAMA_PARSE_VERSION || "latest";
}

function parseTimeoutMs(value: string | undefined, fallbackMs: number) {
  if (!value) {
    return fallbackMs;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

const LLAMA_PARSE_TIMEOUT_MS = parseTimeoutMs(
  process.env.LLAMA_PARSE_TIMEOUT_MS,
  180_000
);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function extractWithLlamaParse(buffer: Buffer, fileName: string) {
  const { default: LlamaCloud } = await import("@llamaindex/llama-cloud");
  const client = new LlamaCloud({
    apiKey: process.env.LLAMA_CLOUD_API_KEY
  });
  const bytes = new Uint8Array(buffer);

  const file = await withTimeout(
    client.files.create({
      file: new File([bytes], fileName),
      purpose: "parse"
    }),
    LLAMA_PARSE_TIMEOUT_MS,
    "LlamaParse file upload"
  );

  const tier = llamaParseTier();
  const result = await withTimeout(
    client.parsing.parse({
      file_id: file.id,
      tier,
      version: llamaParseVersion(),
      expand: ["markdown"],
      ...(tier === "agentic" || tier === "agentic_plus"
        ? {
            agentic_options: {
              custom_prompt: llamaParsePrompt()
            }
          }
        : {})
    }),
    LLAMA_PARSE_TIMEOUT_MS,
    "LlamaParse parsing"
  );

  const rawText = Array.isArray(result?.markdown?.pages)
    ? result.markdown.pages
        .map((page) =>
          page && typeof page === "object" && "markdown" in page
            ? page.markdown ?? ""
            : ""
        )
        .join("\n\n")
    : "";

  if (!rawText.trim()) {
    throw new UnreadableDocumentError("LlamaParse returned empty content.");
  }

  return {
    rawText,
    normalizedText: normalizeDocumentText(rawText)
  };
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

export type ExtractionResult = {
  rawText: string;
  normalizedText: string;
  _debug?: {
    parser: string;
    durationMs: number;
    fileSizeBytes: number;
    extractedChars: number;
  };
};

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractionResult> {
  const startedAt = Date.now();
  const fileSizeBytes = buffer.length;

  function debugMeta(parser: string, text: string) {
    const durationMs = Date.now() - startedAt;
    console.info(`[extract] ${parser} | ${fileName} | ${fileSizeBytes} bytes | ${text.length} chars | ${durationMs}ms`);
    return { parser, durationMs, fileSizeBytes, extractedChars: text.length };
  }

  if (hasLlamaParseKey() && shouldTryLlamaParse(mimeType, fileName)) {
    try {
      const result = await extractWithLlamaParse(buffer, fileName);
      return { ...result, _debug: debugMeta("llamaparse", result.rawText) };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      console.warn(`[extract] llamaparse FAILED after ${durationMs}ms, falling back to local`, {
        fileName,
        mimeType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  ) {
    const result = await pdfParse(buffer);
    return {
      rawText: result.text,
      normalizedText: normalizeDocumentText(result.text),
      _debug: debugMeta("pdf-parse", result.text)
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
