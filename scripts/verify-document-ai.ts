/**
 * One-off script to verify local Document AI access through ADC or service-account JSON.
 *
 * Usage:
 *   pnpm exec tsx scripts/verify-document-ai.ts
 *   pnpm exec tsx scripts/verify-document-ai.ts /absolute/path/to/file.pdf application/pdf
 */

require.extensions = require.extensions || {};
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return require.resolve("./noop-stub");
  return origResolve.call(this, request, ...args);
};

import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_FILE_PATH = path.join(
  process.cwd(),
  "public/sample-documents/northstar-skin-spring-glow-campaign-contract.pdf"
);
const DEFAULT_MIME_TYPE = "application/pdf";

async function main() {
  const filePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE_PATH;
  const mimeType = process.argv[3] ?? DEFAULT_MIME_TYPE;

  console.log(`Reading file: ${filePath}`);
  const bytes = await readFile(filePath);

  const { getDocumentAiConfigSummary } = await import("../lib/document-ai");
  const { extractDocumentText } = await import("../lib/documents/extract");

  console.log("Document AI config:");
  console.log(JSON.stringify(getDocumentAiConfigSummary(), null, 2));

  console.log("\nRunning extraction with Document AI preferred...");
  const result = await extractDocumentText(bytes, mimeType, path.basename(filePath), {
    preferDocumentAi: true
  });

  console.log("\nVerification result:");
  console.log(
    JSON.stringify(
      {
        parser: result._debug?.parser,
        extractedChars: result._debug?.extractedChars,
        durationMs: result._debug?.durationMs,
        preview: result.normalizedText.slice(0, 500)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Document AI verification failed:", error);
  process.exit(1);
});
