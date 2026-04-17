import { describe, expect, test } from "vitest";

import { normalizeTerms } from "@/lib/analysis/normalizers";
import { createEmptyTerms } from "@/lib/analysis/extract/shared";
import { mergeTerms } from "@/lib/deals";

describe("brief data normalization", () => {
// fallow-ignore-next-line complexity
  test("preserves nested briefData workflow fields from extraction output", () => {
    const fallback = createEmptyTerms();

    const normalized = normalizeTerms(
      {
        briefData: {
          campaignCode: "IFL-CVG-2026-CF-0198",
          jobNumber: "JOB-4421",
          referenceId: "REF-2026-991",
          campaignFlight: "03/2026 to 05/2026",
          agreementStartDate: "March 1, 2026",
          agreementEndDate: "May 31, 2026",
          executionTargetDate: "February 26, 2026",
          conceptDueDate: "March 3, 2026",
          draftDueDate: "March 10, 2026",
          campaignLiveDate: "March 20, 2026",
          postDuration: "90 days from go-live date",
          amplificationPeriod: "30 days from first post",
          creatorHandle: "@covergirlcreator",
          approvalRequirements: "Agency approval required before any content is published.",
          revisionRequirements: "Creator must revise within 48 hours per feedback round.",
          reportingRequirements: "Insights due within 24 hours of written request.",
          requiredClaims: ["Use #covergirlpartner", "Mention clean ingredients"],
          paymentSchedule: "50% on signature, 50% after final live links",
          paymentRequirements: "Invoice and live links required before final payment",
          paymentNotes: "Payments are processed through the agency AP portal."
        }
      },
      fallback
    );

    expect(normalized.briefData?.campaignCode).toBe("IFL-CVG-2026-CF-0198");
    expect(normalized.briefData?.jobNumber).toBe("JOB-4421");
    expect(normalized.briefData?.referenceId).toBe("REF-2026-991");
    expect(normalized.briefData?.campaignFlight).toBe("03/2026 to 05/2026");
    expect(normalized.briefData?.agreementStartDate).toBe("March 1, 2026");
    expect(normalized.briefData?.agreementEndDate).toBe("May 31, 2026");
    expect(normalized.briefData?.executionTargetDate).toBe("February 26, 2026");
    expect(normalized.briefData?.conceptDueDate).toBe("March 3, 2026");
    expect(normalized.briefData?.draftDueDate).toBe("March 10, 2026");
    expect(normalized.briefData?.campaignLiveDate).toBe("March 20, 2026");
    expect(normalized.briefData?.postDuration).toBe("90 days from go-live date");
    expect(normalized.briefData?.amplificationPeriod).toBe("30 days from first post");
    expect(normalized.briefData?.creatorHandle).toBe("@covergirlcreator");
    expect(normalized.briefData?.approvalRequirements).toBe(
      "Agency approval required before any content is published."
    );
    expect(normalized.briefData?.revisionRequirements).toBe(
      "Creator must revise within 48 hours per feedback round."
    );
    expect(normalized.briefData?.reportingRequirements).toBe(
      "Insights due within 24 hours of written request."
    );
    expect(normalized.briefData?.requiredClaims).toEqual([
      "Use #covergirlpartner",
      "Mention clean ingredients"
    ]);
    expect(normalized.briefData?.paymentSchedule).toBe(
      "50% on signature, 50% after final live links"
    );
    expect(normalized.briefData?.paymentRequirements).toBe(
      "Invoice and live links required before final payment"
    );
    expect(normalized.briefData?.paymentNotes).toBe(
      "Payments are processed through the agency AP portal."
    );
  });

  test("mergeTerms preserves operational brief fields when a later patch omits them", () => {
    const base = createEmptyTerms();
    base.briefData = {
      campaignOverview: null,
      campaignCode: "IFL-CVG-2026-CF-0198",
      jobNumber: "JOB-4421",
      referenceId: "REF-2026-991",
      messagingPoints: [],
      talkingPoints: [],
      creativeConceptOverview: null,
      requiredClaims: ["Use #covergirlpartner"],
      brandGuidelines: null,
      approvalRequirements: "Agency approval required before any content is published.",
      revisionRequirements: "Creator must revise within 48 hours per feedback round.",
      targetAudience: null,
      toneAndStyle: null,
      doNotMention: [],
      deliverablesSummary: null,
      deliverablePlatforms: [],
      creatorHandle: "@covergirlcreator",
      postingSchedule: null,
      agreementStartDate: "March 1, 2026",
      agreementEndDate: "May 31, 2026",
      executionTargetDate: "February 26, 2026",
      conceptDueDate: "March 3, 2026",
      campaignLiveDate: "March 20, 2026",
      campaignFlight: "03/2026 to 05/2026",
      draftDueDate: "March 10, 2026",
      contentDueDate: null,
      postDuration: "90 days from go-live date",
      amplificationPeriod: "30 days from first post",
      usageNotes: null,
      disclosureRequirements: [],
      competitorRestrictions: [],
      linksAndAssets: [],
      promoCode: null,
      paymentSchedule: "50% on signature, 50% after final live links",
      paymentRequirements: "Invoice and live links required before final payment",
      paymentNotes: "Payments are processed through the agency AP portal.",
      reportingRequirements: "Insights due within 24 hours of written request.",
      campaignNotes: null,
      sourceDocumentIds: ["doc-1"]
    };

    const merged = mergeTerms(base, {
      briefData: {
        campaignOverview: null,
        messagingPoints: [],
        talkingPoints: [],
        creativeConceptOverview: null,
        brandGuidelines: null,
        approvalRequirements: null,
        targetAudience: null,
        toneAndStyle: null,
        doNotMention: [],
        sourceDocumentIds: ["doc-2"]
      }
    });

    expect(merged.briefData?.jobNumber).toBe("JOB-4421");
    expect(merged.briefData?.referenceId).toBe("REF-2026-991");
    expect(merged.briefData?.creatorHandle).toBe("@covergirlcreator");
    expect(merged.briefData?.agreementStartDate).toBe("March 1, 2026");
    expect(merged.briefData?.agreementEndDate).toBe("May 31, 2026");
    expect(merged.briefData?.executionTargetDate).toBe("February 26, 2026");
    expect(merged.briefData?.paymentSchedule).toBe(
      "50% on signature, 50% after final live links"
    );
    expect(merged.briefData?.paymentRequirements).toBe(
      "Invoice and live links required before final payment"
    );
    expect(merged.briefData?.sourceDocumentIds).toEqual(["doc-1", "doc-2"]);
  });
});
