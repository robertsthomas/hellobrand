/**
 * Runs a representative brief/deck document through the Document AI brief processor.
 *
 * Usage:
 *   doppler run -- pnpm exec tsx scripts/verify-document-ai-brief.ts
 */

require.extensions = require.extensions || {};
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return require.resolve("./noop-stub.js");
  return origResolve.call(this, request, ...args);
};

import { readFileSync } from "node:fs";
import path from "node:path";

const SAMPLE_PATHS = [
  path.join(process.cwd(), "example-docs", "HB-BEAUTY-001 campaign_brief.pdf"),
  path.join(process.cwd(), "example-docs", "Amazon Kids Influencer Brief_ Stories with Alexa.docx")
];

function findSamplePath() {
  for (const path of SAMPLE_PATHS) {
    try {
      readFileSync(path);
      return path;
    } catch {
      // Try the next sample.
    }
  }

  throw new Error("No local brief sample document found.");
}

function inferMimeType(filePath: string) {
  if (filePath.toLowerCase().endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/pdf";
}

async function main() {
  const { extractBriefTermsWithDocumentAiDetailed } = await import(
    "../lib/document-ai-brief"
  );
  const filePath = process.argv[2] ?? findSamplePath();
  const bytes = readFileSync(filePath);
  const result = await extractBriefTermsWithDocumentAiDetailed({
    bytes,
    mimeType: inferMimeType(filePath),
    deal: {
      brandName: null,
      campaignName: null
    }
  });

  console.log(
    JSON.stringify(
      {
        filePath,
        processor: result.processor,
        confidence: result.extraction.confidence,
        briefData: result.extraction.data.briefData,
        evidenceCount: result.extraction.evidence.length,
        conflicts: result.extraction.conflicts
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
