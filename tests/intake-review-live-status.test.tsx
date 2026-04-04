import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { IntakeReviewLiveStatus } from "@/components/intake-review-live-status";

describe("IntakeReviewLiveStatus", () => {
  test("shows background analysis and existing watchouts while late stages are still running", () => {
    const html = renderToStaticMarkup(
      <IntakeReviewLiveStatus
        sessionId="session-1"
        initialStatus="ready_for_confirmation"
        initialProcessing={{
          currentStage: "risk_review",
          activeJobType: "analyze_risks",
          activeLabel: "Reviewing rights and conflicts",
          activeDescription: "Checking restrictions, disclosure obligations, and creator risks.",
          completedStages: ["extracting", "structuring"],
          isRunning: true
        }}
        conflictResults={[
          {
            type: "category_conflict",
            level: "warning",
            severity: "medium",
            confidence: 0.82,
            title: "Category overlap detected",
            detail: "Another active deal targets the same category.",
            relatedDealIds: [],
            evidenceRefs: []
          }
        ]}
        initialRiskFlags={[
          {
            id: "risk-1",
            dealId: "deal-1",
            category: "usage_rights",
            title: "Paid usage included",
            detail: "Paid usage appears to be bundled into the agreement.",
            severity: "high",
            suggestedAction: null,
            evidence: [],
            sourceDocumentId: "doc-1",
            createdAt: new Date().toISOString()
          }
        ]}
      />
    );

    expect(html).toContain("Finalizing AI review");
    expect(html).toContain("Fields ready to review");
    expect(html).toContain("Risk review");
    expect(html).toContain("Workspace summary");
    expect(html).toContain("Needs attention (2)");
    expect(html).toContain("Category overlap detected");
    expect(html).toContain("Paid usage included");
  });
});
