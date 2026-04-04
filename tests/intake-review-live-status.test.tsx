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
    expect(html).toContain("Core fields ready to review");
    expect(html).toContain("Risk review");
    expect(html).toContain("Workspace summary");
    expect(html).toContain("Needs attention (2)");
    expect(html).toContain("Category overlap detected");
    expect(html).toContain("Paid usage included");
  });

  test("dedupes repeated risk flags in needs attention", () => {
    const html = renderToStaticMarkup(
      <IntakeReviewLiveStatus
        sessionId="session-1"
        initialStatus="ready_for_confirmation"
        initialProcessing={{
          currentStage: null,
          activeJobType: null,
          activeLabel: "",
          activeDescription: "",
          completedStages: ["extracting", "structuring", "risk_review", "summary"],
          isRunning: false
        }}
        conflictResults={[]}
        initialRiskFlags={[
          {
            id: "risk-1",
            dealId: "deal-1",
            category: "deliverables",
            title: "Deliverables may be vague",
            detail: "The exact content requirements may be too open-ended for a smooth campaign workflow.",
            severity: "medium",
            suggestedAction: null,
            evidence: [],
            sourceDocumentId: "doc-1",
            createdAt: new Date().toISOString()
          },
          {
            id: "risk-2",
            dealId: "deal-1",
            category: "deliverables",
            title: "Deliverables may be vague",
            detail: "The exact content requirements may be too open-ended for a smooth campaign workflow.",
            severity: "medium",
            suggestedAction: null,
            evidence: [],
            sourceDocumentId: "doc-2",
            createdAt: new Date().toISOString()
          }
        ]}
      />
    );

    expect(html).toContain("Needs attention (1)");
    expect(html.match(/Deliverables may be vague/g)?.length).toBe(1);
  });
});
