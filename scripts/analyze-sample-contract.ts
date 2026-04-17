// fallow-ignore-file unused-file
/**
 * One-off script to analyze the sample contract PDF through the real pipeline.
 *
 * Usage: npx tsx scripts/analyze-sample-contract.ts
 */

// Stub server-only so it doesn't throw at import time
require.extensions = require.extensions || {};
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return require.resolve("./noop-stub");
  return origResolve.call(this, request, ...args);
};

import { readFile } from "node:fs/promises";
import path from "node:path";

const PDF_PATH = path.join(
  process.cwd(),
  "public/sample-documents/northstar-skin-spring-glow-campaign-contract.pdf"
);
const FILE_NAME = "northstar-skin-spring-glow-campaign-contract.pdf";

async function main() {
  console.log("Reading PDF...");
  const buffer = await readFile(PDF_PATH);

  console.log("Extracting text...");
  const { extractDocumentText } = await import("../lib/documents/extract");
  const result = await extractDocumentText(buffer, "application/pdf", FILE_NAME);
  const text = result.normalizedText;
  console.log(`Extracted ${text.length} characters\n`);

  console.log("Classifying document...");
  const { classifyDocumentHeuristically } = await import("../lib/analysis/fallback");
  const classification = classifyDocumentHeuristically(text, FILE_NAME);
  console.log(`Kind: ${classification.documentKind} (confidence: ${classification.confidence})\n`);

  console.log("Running analysis...");
  const { analyzeDocument } = await import("../lib/analysis");
  const analysis = await analyzeDocument(text, {
    fileName: FILE_NAME,
    documentKindHint: classification.documentKind
  });

  console.log("Building breakdown...");
  const { buildAnonymousDealBreakdown } = await import("../lib/public-anonymous-analysis");
  const breakdown = buildAnonymousDealBreakdown({
    fileName: FILE_NAME,
    analysis
  });

  console.log("\n========== RESULT ==========\n");
  console.log(JSON.stringify(breakdown, null, 2));
}

main().catch((error) => {
  console.error("Analysis failed:", error);
  process.exit(1);
});
