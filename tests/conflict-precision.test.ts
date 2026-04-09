import { describe, expect, test } from "vitest";

import { buildConflictResults } from "@/lib/conflict-intelligence";
import { createSeedStore } from "@/lib/repository/seed";
import type { DealAggregate, DealTermsRecord } from "@/lib/types";

type TermsShape = Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt">;

function makeDealAggregate(
  overrides: {
    id?: string;
    brandName?: string;
    campaignName?: string;
    confirmedAt?: string | null;
    status?: string;
    terms?: Partial<TermsShape>;
  } = {}
): DealAggregate {
  const seed = createSeedStore();
  const now = new Date().toISOString();
  const id = overrides.id ?? `deal-${Math.random().toString(36).slice(2, 8)}`;

  return {
    deal: {
      ...seed.deals[0],
      id,
      brandName: overrides.brandName ?? seed.deals[0].brandName,
      campaignName: overrides.campaignName ?? seed.deals[0].campaignName,
      confirmedAt: overrides.confirmedAt !== undefined ? overrides.confirmedAt : now,
      status: (overrides.status as DealAggregate["deal"]["status"]) ?? "negotiating"
    },
    latestDocument: seed.documents[0],
    documents: seed.documents,
    terms: {
      ...seed.dealTerms[0],
      id: `terms-${id}`,
      dealId: id,
      ...(overrides.terms ?? {})
    } as DealTermsRecord,
    conflictResults: [],
    paymentRecord: null,
    riskFlags: [],
    emailDrafts: [],
    jobs: [],
    documentSections: [],
    documentRuns: [],
    documentArtifacts: [],
    documentFieldEvidence: [],
    documentReviewItems: [],
    extractionResults: [],
    extractionEvidence: [],
    summaries: [],
    currentSummary: null,
    intakeSession: null
  };
}

describe("cross-deal conflict precision", () => {
  test("1: same category, different brand → category_conflict warning", () => {
    const oreo = makeDealAggregate({
      id: "deal-oreo",
      brandName: "Oreo",
      terms: { brandCategory: "food_beverage" }
    });
    const goldfish = makeDealAggregate({
      id: "deal-goldfish",
      brandName: "Goldfish",
      terms: { brandCategory: "food_beverage" }
    });

    const conflicts = buildConflictResults(oreo, [oreo, goldfish]);
    expect(conflicts.some((c) => c.type === "category_conflict")).toBe(true);
    const catConflict = conflicts.find((c) => c.type === "category_conflict")!;
    expect(catConflict.level).toBe("warning");
  });

  test("2: similar but different categories → no conflict", () => {
    const fitness = makeDealAggregate({
      id: "deal-fitness",
      brandName: "FitBrand",
      terms: {
        brandCategory: "fitness_wellness",
        restrictedCategories: [],
        competitorCategories: []
      }
    });
    const beauty = makeDealAggregate({
      id: "deal-beauty",
      brandName: "BeautyBrand",
      terms: {
        brandCategory: "beauty_personal_care",
        restrictedCategories: [],
        competitorCategories: []
      }
    });

    const conflicts = buildConflictResults(fitness, [fitness, beauty]);
    expect(conflicts.some((c) => c.type === "category_conflict")).toBe(false);
  });

  test("3: near-miss dates (2 days apart, within 3-day threshold) → schedule_collision, confidence 0.68", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Brand A",
      terms: {
        brandCategory: "tech_gaming",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-04-10T00:00:00.000Z",
          endDate: "2026-04-10T00:00:00.000Z",
          postingWindow: "2026-04-10"
        }
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Brand B",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-04-12T00:00:00.000Z",
          endDate: "2026-04-12T00:00:00.000Z",
          postingWindow: "2026-04-12"
        }
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    const collision = conflicts.find((c) => c.type === "schedule_collision");
    expect(collision).toBeTruthy();
    expect(collision!.confidence).toBe(0.68);
  });

  test("4: dates 4 days apart → no schedule_collision", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Brand A",
      terms: {
        brandCategory: "tech_gaming",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-04-10T00:00:00.000Z",
          endDate: "2026-04-10T00:00:00.000Z",
          postingWindow: "2026-04-10"
        }
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Brand B",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-04-14T00:00:00.000Z",
          endDate: "2026-04-14T00:00:00.000Z",
          postingWindow: "2026-04-14"
        }
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    expect(conflicts.some((c) => c.type === "schedule_collision")).toBe(false);
  });

  test("5: exact date window overlap → schedule_collision, confidence 0.83", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Brand A",
      terms: {
        brandCategory: "tech_gaming",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-04-10T00:00:00.000Z",
          endDate: "2026-04-15T00:00:00.000Z",
          postingWindow: "2026-04-10 to 2026-04-15"
        }
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Brand B",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-04-12T00:00:00.000Z",
          endDate: "2026-04-18T00:00:00.000Z",
          postingWindow: "2026-04-12 to 2026-04-18"
        }
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    const collision = conflicts.find((c) => c.type === "schedule_collision");
    expect(collision).toBeTruthy();
    expect(collision!.confidence).toBe(0.83);
  });

  test("6: bidirectional competitor restriction → competitor_restriction from both directions", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Oreo",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: ["Food & beverage"],
        competitorCategories: ["Food & beverage"]
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Goldfish",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: ["Food & beverage"],
        competitorCategories: ["Food & beverage"]
      }
    });

    const conflictsFromA = buildConflictResults(dealA, [dealA, dealB]);
    const conflictsFromB = buildConflictResults(dealB, [dealA, dealB]);
    const aRestrictions = conflictsFromA.filter((c) => c.type === "competitor_restriction");
    const bRestrictions = conflictsFromB.filter((c) => c.type === "competitor_restriction");
    expect(aRestrictions.length).toBeGreaterThanOrEqual(2);
    expect(bRestrictions.length).toBeGreaterThanOrEqual(2);
  });

  test("7: unidirectional competitor restriction → one competitor_restriction only", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Oreo",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: ["Food & beverage"],
        competitorCategories: ["Food & beverage"]
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Goldfish",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: [],
        competitorCategories: []
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    const restrictions = conflicts.filter((c) => c.type === "competitor_restriction");
    expect(restrictions.length).toBe(1);
    expect(restrictions[0].title).toContain("Goldfish");
  });

  test("8: exclusivity overlap (same category + overlapping dates + both exclusive) → exclusivity_overlap, hard_conflict", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Oreo",
      terms: {
        brandCategory: "food_beverage",
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-04-01T00:00:00.000Z",
          endDate: "2026-04-30T00:00:00.000Z",
          postingWindow: "2026-04-01 to 2026-04-30"
        }
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Goldfish",
      terms: {
        brandCategory: "food_beverage",
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-04-15T00:00:00.000Z",
          endDate: "2026-05-15T00:00:00.000Z",
          postingWindow: "2026-04-15 to 2026-05-15"
        }
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    const exclusivity = conflicts.find((c) => c.type === "exclusivity_overlap");
    expect(exclusivity).toBeTruthy();
    expect(exclusivity!.level).toBe("hard_conflict");
  });

  test("9: exclusivity but non-overlapping dates → no exclusivity_overlap", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Oreo",
      terms: {
        brandCategory: "food_beverage",
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-15T00:00:00.000Z",
          postingWindow: "2026-03-01 to 2026-03-15"
        }
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Goldfish",
      terms: {
        brandCategory: "food_beverage",
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-05-01T00:00:00.000Z",
          endDate: "2026-05-31T00:00:00.000Z",
          postingWindow: "2026-05-01 to 2026-05-31"
        }
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    expect(conflicts.some((c) => c.type === "exclusivity_overlap")).toBe(false);
  });

  test("10: exclusivity with overlapping dates but different categories → no exclusivity_overlap", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Oreo",
      terms: {
        brandCategory: "food_beverage",
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-04-01T00:00:00.000Z",
          endDate: "2026-04-30T00:00:00.000Z",
          postingWindow: "2026-04-01 to 2026-04-30"
        }
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Nike",
      terms: {
        brandCategory: "sports_outdoors",
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-04-10T00:00:00.000Z",
          endDate: "2026-05-10T00:00:00.000Z",
          postingWindow: "2026-04-10 to 2026-05-10"
        }
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    expect(conflicts.some((c) => c.type === "exclusivity_overlap")).toBe(false);
  });

  test("11: completely unrelated deals → zero conflicts", () => {
    const entertainment = makeDealAggregate({
      id: "deal-entertainment",
      brandName: "Netflix",
      terms: {
        brandCategory: "entertainment_media",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-06-01T00:00:00.000Z",
          endDate: "2026-06-05T00:00:00.000Z",
          postingWindow: "2026-06-01 to 2026-06-05"
        }
      }
    });
    const finance = makeDealAggregate({
      id: "deal-finance",
      brandName: "Robinhood",
      terms: {
        brandCategory: "finance",
        restrictedCategories: [],
        competitorCategories: [],
        exclusivityApplies: false,
        campaignDateWindow: {
          startDate: "2026-09-01T00:00:00.000Z",
          endDate: "2026-09-15T00:00:00.000Z",
          postingWindow: "2026-09-01 to 2026-09-15"
        }
      }
    });

    const conflicts = buildConflictResults(entertainment, [entertainment, finance]);
    expect(conflicts.length).toBe(0);
  });

  test("12: completed deal excluded → zero conflicts", () => {
    const active = makeDealAggregate({
      id: "deal-active",
      brandName: "Oreo",
      terms: { brandCategory: "food_beverage" }
    });
    const completed = makeDealAggregate({
      id: "deal-completed",
      brandName: "Goldfish",
      status: "completed",
      terms: { brandCategory: "food_beverage" }
    });

    const conflicts = buildConflictResults(active, [active, completed]);
    expect(conflicts.length).toBe(0);
  });

  test("13: unconfirmed deal excluded → zero conflicts", () => {
    const active = makeDealAggregate({
      id: "deal-active",
      brandName: "Oreo",
      terms: { brandCategory: "food_beverage" }
    });
    const unconfirmed = makeDealAggregate({
      id: "deal-unconfirmed",
      brandName: "Goldfish",
      confirmedAt: null,
      terms: { brandCategory: "food_beverage" }
    });

    const conflicts = buildConflictResults(active, [active, unconfirmed]);
    expect(conflicts.length).toBe(0);
  });

  test("14: known brand hint override (Lunchables → food_beverage) → correct category", () => {
    const lunchables = makeDealAggregate({
      id: "deal-lunchables",
      brandName: "Lunchables",
      terms: { brandCategory: "food_beverage" }
    });
    const otherFood = makeDealAggregate({
      id: "deal-food",
      brandName: "Goldfish",
      terms: { brandCategory: "food_beverage" }
    });

    const conflicts = buildConflictResults(lunchables, [lunchables, otherFood]);
    expect(conflicts.some((c) => c.type === "category_conflict")).toBe(true);
    expect(lunchables.terms!.brandCategory).toBe("food_beverage");
  });

  test("15: all confidence values within expected ranges (0.68-0.9)", () => {
    const dealA = makeDealAggregate({
      id: "deal-a",
      brandName: "Oreo",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: ["Food & beverage"],
        competitorCategories: ["Food & beverage"],
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-04-01T00:00:00.000Z",
          endDate: "2026-04-30T00:00:00.000Z",
          postingWindow: "2026-04-01 to 2026-04-30"
        }
      }
    });
    const dealB = makeDealAggregate({
      id: "deal-b",
      brandName: "Goldfish",
      terms: {
        brandCategory: "food_beverage",
        restrictedCategories: ["Food & beverage"],
        competitorCategories: ["Food & beverage"],
        exclusivityApplies: true,
        exclusivityDuration: "30 days",
        campaignDateWindow: {
          startDate: "2026-04-15T00:00:00.000Z",
          endDate: "2026-05-15T00:00:00.000Z",
          postingWindow: "2026-04-15 to 2026-05-15"
        }
      }
    });

    const conflicts = buildConflictResults(dealA, [dealA, dealB]);
    expect(conflicts.length).toBeGreaterThan(0);

    for (const conflict of conflicts) {
      expect(conflict.confidence).toBeGreaterThanOrEqual(0.68);
      expect(conflict.confidence).toBeLessThanOrEqual(0.9);
    }
  });
});
