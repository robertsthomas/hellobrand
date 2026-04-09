import { afterEach, describe, expect, test } from "vitest";

import {
  estimateDocumentAiCostUsd,
  evaluateDocumentPipelineRollout
} from "@/lib/document-pipeline-rollout";

afterEach(() => {
  delete process.env.DOCUMENT_PIPELINE_V2_FORCE_LEGACY;
  delete process.env.DOCUMENT_PIPELINE_V2_ALLOWED_KINDS;
  delete process.env.DOCUMENT_PIPELINE_V2_COHORT_PERCENT;
  delete process.env.DOCUMENT_PIPELINE_V2_ALLOWED_USER_IDS;
});

describe("document pipeline rollout", () => {
  test("force legacy disables rollout", () => {
    process.env.DOCUMENT_PIPELINE_V2_FORCE_LEGACY = "1";

    const decision = evaluateDocumentPipelineRollout({
      documentKind: "invoice",
      dealId: "deal-1",
      userId: "user-1"
    });

    expect(decision.enabled).toBe(false);
    expect(decision.reasons).toContain("force_legacy");
  });

  test("allowlist limits rollout to specific users", () => {
    process.env.DOCUMENT_PIPELINE_V2_ALLOWED_USER_IDS = "user-allowed";

    const blocked = evaluateDocumentPipelineRollout({
      documentKind: "invoice",
      dealId: "deal-2",
      userId: "user-blocked"
    });
    const allowed = evaluateDocumentPipelineRollout({
      documentKind: "invoice",
      dealId: "deal-3",
      userId: "user-allowed"
    });

    expect(blocked.enabled).toBe(false);
    expect(blocked.reasons).toContain("user_not_allowlisted");
    expect(allowed.enabled).toBe(true);
  });

  test("estimates per-page processor cost", () => {
    expect(estimateDocumentAiCostUsd("layout", 10)).toBe(0.1);
    expect(estimateDocumentAiCostUsd("ocr", 10)).toBe(0.015);
    expect(estimateDocumentAiCostUsd("invoice", 10)).toBe(0.1);
    expect(estimateDocumentAiCostUsd("contract", 10)).toBe(0.3);
  });
});
