import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  fallbackAnalyzeDocument,
  fallbackAnalyzeContract
} from "@/lib/analysis/fallback";

function loadFixture(name: string) {
  return readFileSync(
    path.join(process.cwd(), `fixtures/contracts/${name}`),
    "utf8"
  );
}

describe("creator-rights analyzer", () => {
  test("1: perpetual worldwide usage → usage_rights, high severity", () => {
    const text = loadFixture("perpetual-usage-rights.txt");
    const result = fallbackAnalyzeContract(text);

    const usageRisks = result.riskFlags.filter((f) => f.category === "usage_rights");
    expect(usageRisks.length).toBeGreaterThan(0);

    const perpetualRisk = usageRisks.find((f) =>
      f.title.toLowerCase().includes("perpetual")
    );
    expect(perpetualRisk).toBeTruthy();
    expect(perpetualRisk!.severity).toBe("high");
  });

  test("2: whitelisting + paid social → usage_rights, high severity", () => {
    const text = loadFixture("perpetual-usage-rights.txt");
    const result = fallbackAnalyzeContract(text);

    const paidUsageRisk = result.riskFlags.find(
      (f) => f.category === "usage_rights" && f.title.toLowerCase().includes("paid")
    );
    expect(paidUsageRisk).toBeTruthy();
    expect(paidUsageRisk!.severity).toBe("high");
    expect(result.terms.usageRightsPaidAllowed).toBe(true);
  });

  test("3: 90-day exclusivity in category → exclusivity, medium severity", () => {
    const text = loadFixture("exclusivity-restriction.txt");
    const result = fallbackAnalyzeContract(text);

    const exclusivityRisk = result.riskFlags.find((f) => f.category === "exclusivity");
    expect(exclusivityRisk).toBeTruthy();
    expect(exclusivityRisk!.severity).toBe("medium");
    expect(result.terms.exclusivityApplies).toBe(true);
  });

  test("4: Net 60 payment terms → payment_terms, medium severity", () => {
    const text = loadFixture("long-payment-terms.txt");
    const result = fallbackAnalyzeContract(text);

    const paymentRisk = result.riskFlags.find((f) => f.category === "payment_terms");
    expect(paymentRisk).toBeTruthy();
    expect(paymentRisk!.severity).toBe("medium");
    expect(result.terms.netTermsDays).toBe(60);
  });

  test("5: vague deliverables (content as requested, TBD) → deliverables, medium severity", () => {
    const text = loadFixture("vague-deliverables.txt");
    const result = fallbackAnalyzeContract(text);

    const deliverableRisk = result.riskFlags.find((f) => f.category === "deliverables");
    expect(deliverableRisk).toBeTruthy();
    expect(deliverableRisk!.severity).toBe("medium");
  });

  test("6: terminate immediately without notice → termination, medium severity", () => {
    const text = loadFixture("one-sided-termination.txt");
    const result = fallbackAnalyzeContract(text);

    const terminationRisk = result.riskFlags.find((f) => f.category === "termination");
    expect(terminationRisk).toBeTruthy();
    expect(terminationRisk!.severity).toBe("medium");
  });

  test("7: clean, fair contract → other (manual review), low severity", () => {
    const cleanContract = `
Creator Agreement

Brand: Friendly Co
Creator: Sam Park

Compensation
Brand shall pay Creator $2,500 on Net 15 terms.

Deliverables
1 Instagram Reel and 2 Instagram Stories featuring the spring collection.

Usage Rights
Brand receives organic repost rights for 30 days on Brand's owned social channels only.

Revisions
Two rounds of revisions within 5 business days.

Termination
Either party may terminate with 30 days written notice. All completed work will be compensated.

Governing Law
This agreement shall be governed by the laws of New York.
`;
    const result = fallbackAnalyzeContract(cleanContract);

    const manualReview = result.riskFlags.find((f) => f.category === "other");
    expect(manualReview).toBeTruthy();
    expect(manualReview!.severity).toBe("low");
    expect(result.riskFlags.filter((f) => f.severity === "high").length).toBe(0);
  });

  test("8: multi-risk combined (3+ flags) → multiple categories, mixed severity", () => {
    const text = loadFixture("mixed-risk-contract.txt");
    const result = fallbackAnalyzeContract(text);

    const categories = new Set(result.riskFlags.map((f) => f.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);

    expect(result.riskFlags.some((f) => f.severity === "high")).toBe(true);
    expect(result.riskFlags.some((f) => f.severity === "medium")).toBe(true);
  });

  test("9: truncated/partial text → detects what is present, degrades gracefully", () => {
    const partialText = `
Creator Agreement

Compensation
Brand shall pay Creator $1,500 on Net 45 terms.

Usage Rights
Brand is granted perpetual rights to use all content
`;
    const result = fallbackAnalyzeContract(partialText);

    expect(result.terms.paymentAmount).toBe(1500);
    expect(result.terms.netTermsDays).toBe(45);
    const perpetualRisk = result.riskFlags.find(
      (f) => f.category === "usage_rights" && f.title.toLowerCase().includes("perpetual")
    );
    expect(perpetualRisk).toBeTruthy();
  });

  test("10: contradictory clauses (90 days then perpetual) → detects perpetual, high severity", () => {
    const contradictory = `
Creator Agreement

Usage Rights
Brand receives content usage rights for 90 days on organic channels.

Extended Usage
Notwithstanding the above, Brand is granted perpetual, worldwide rights to use all content for paid social and digital advertising in perpetuity. Content may be used for whitelisting and paid social ads.

Compensation
Brand shall pay Creator $2,000 on Net 30 terms.

Deliverables
1 TikTok Video.
`;
    const result = fallbackAnalyzeContract(contradictory);

    const perpetualRisk = result.riskFlags.find(
      (f) => f.category === "usage_rights" && f.title.toLowerCase().includes("perpetual")
    );
    expect(perpetualRisk).toBeTruthy();
    expect(perpetualRisk!.severity).toBe("high");
  });

  test("every suggestedAction contains actionable verb", () => {
    const fixtures = [
      "perpetual-usage-rights.txt",
      "one-sided-termination.txt",
      "long-payment-terms.txt",
      "exclusivity-restriction.txt",
      "vague-deliverables.txt",
      "mixed-risk-contract.txt"
    ];

    const actionVerbs = ["ask", "limit", "request", "confirm", "reduce", "check", "double-check"];

    for (const fixture of fixtures) {
      const text = loadFixture(fixture);
      const result = fallbackAnalyzeContract(text);

      for (const flag of result.riskFlags) {
        if (!flag.suggestedAction) continue;
        const lower = flag.suggestedAction.toLowerCase();
        const hasVerb = actionVerbs.some((verb) => lower.includes(verb));
        expect(
          hasVerb,
          `${fixture}: suggestedAction "${flag.suggestedAction}" should contain an actionable verb`
        ).toBe(true);
      }
    }
  });

  test("severity high only for perpetual/paid usage", () => {
    const fixtures = [
      "perpetual-usage-rights.txt",
      "one-sided-termination.txt",
      "long-payment-terms.txt",
      "exclusivity-restriction.txt",
      "vague-deliverables.txt"
    ];

    for (const fixture of fixtures) {
      const text = loadFixture(fixture);
      const result = fallbackAnalyzeContract(text);
      const highFlags = result.riskFlags.filter((f) => f.severity === "high");

      for (const flag of highFlags) {
        expect(flag.category).toBe("usage_rights");
      }
    }
  });

  test("severity low only for fallback manual review", () => {
    const cleanContract = `
Creator Agreement

Compensation
Brand shall pay Creator $2,500 on Net 15 terms.

Deliverables
1 Instagram Reel.

Usage Rights
Organic repost rights for 30 days.

Termination
Either party may terminate with 30 days notice. All completed work compensated.
`;
    const result = fallbackAnalyzeContract(cleanContract);
    const lowFlags = result.riskFlags.filter((f) => f.severity === "low");

    for (const flag of lowFlags) {
      expect(flag.category).toBe("other");
    }
  });
});
