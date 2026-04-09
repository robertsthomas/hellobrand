/**
 * Runs a representative contract PDF through the Document AI contract processor.
 *
 * Usage:
 *   doppler run -- pnpm exec tsx scripts/verify-document-ai-contract.ts
 */

require.extensions = require.extensions || {};
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return require.resolve("./noop-stub");
  return origResolve.call(this, request, ...args);
};

import { access, readFile } from "node:fs/promises";
import path from "node:path";

async function firstExistingPath(paths: string[]) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next path.
    }
  }

  throw new Error(`No contract fixture found in: ${paths.join(", ")}`);
}

async function main() {
  const { extractContractTermsWithDocumentAiDetailed } = await import(
    "../lib/document-ai-contract"
  );

  const contractPath = await firstExistingPath([
    path.join(
      process.cwd(),
      "example-docs",
      "@therobertscasa Kraft Lunchables CLP Influencer Agreement.pdf"
    ),
    path.join(
      process.cwd(),
      "example-docs",
      "OREO Cakesters _ @therobertscasa Agreement.pdf"
    ),
    path.join(
      process.cwd(),
      "public",
      "sample-documents",
      "northstar-skin-spring-glow-campaign-contract.pdf"
    )
  ]);

  const bytes = await readFile(contractPath);
  console.log(`Using contract fixture: ${contractPath}`);
  console.log(`Read contract PDF: ${bytes.length} bytes`);

  const result = await extractContractTermsWithDocumentAiDetailed({
    bytes,
    mimeType: "application/pdf",
    deal: {
      brandName: null,
      campaignName: null
    }
  });

  console.log(
    JSON.stringify(
      {
        processor: result.processor,
        model: result.extraction.model,
        confidence: result.extraction.confidence,
        brandName: result.extraction.data.brandName,
        campaignName: result.extraction.data.campaignName,
        paymentAmount: result.extraction.data.paymentAmount,
        currency: result.extraction.data.currency,
        paymentTerms: result.extraction.data.paymentTerms,
        usageRights: result.extraction.data.usageRights,
        usageDuration: result.extraction.data.usageDuration,
        paidUsageAllowed: result.extraction.data.usageRightsPaidAllowed,
        whitelistingAllowed: result.extraction.data.whitelistingAllowed,
        exclusivity: result.extraction.data.exclusivity,
        exclusivityDuration: result.extraction.data.exclusivityDuration,
        deliverables: result.extraction.data.deliverables,
        revisionRounds: result.extraction.data.revisionRounds,
        termination: result.extraction.data.termination,
        terminationNotice: result.extraction.data.terminationNotice,
        governingLaw: result.extraction.data.governingLaw,
        conflicts: result.extraction.conflicts,
        evidence: result.extraction.evidence.slice(0, 12)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Contract verification failed:", error);
  process.exit(1);
});
