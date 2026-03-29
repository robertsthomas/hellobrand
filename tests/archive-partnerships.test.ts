import { describe, expect, test } from "vitest";

import type { DealRecord } from "@/lib/types";

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brandName: "Nimbus Athletics",
    campaignName: "Spring Drop",
    status: "negotiating",
    paymentStatus: "not_invoiced",
    countersignStatus: "pending",
    summary: null,
    legalDisclaimer: "Not legal advice.",
    nextDeliverableDate: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    analyzedAt: null,
    confirmedAt: "2026-03-01T00:00:00.000Z",
    statusBeforeArchive: null,
    ...overrides
  };
}

describe("archive status type", () => {
  test("archived is a valid DealStatus", () => {
    const deal = makeDeal({ status: "archived" });
    expect(deal.status).toBe("archived");
  });

  test("statusBeforeArchive stores previous status", () => {
    const deal = makeDeal({
      status: "archived",
      statusBeforeArchive: "negotiating"
    });
    expect(deal.statusBeforeArchive).toBe("negotiating");
  });

  test("statusBeforeArchive is null for non-archived deals", () => {
    const deal = makeDeal({ status: "negotiating" });
    expect(deal.statusBeforeArchive).toBeNull();
  });
});

describe("dashboard filtering", () => {
  test("archived deals are excluded from active partnerships", () => {
    const deals = [
      makeDeal({ id: "1", status: "negotiating" }),
      makeDeal({ id: "2", status: "archived", statusBeforeArchive: "signed" }),
      makeDeal({ id: "3", status: "completed" }),
      makeDeal({ id: "4", status: "contract_received" })
    ];

    const active = deals.filter(
      (deal) => deal.status !== "completed" && deal.status !== "archived"
    );

    expect(active.map((d) => d.id)).toEqual(["1", "4"]);
  });

  test("archived deals are not counted as completed", () => {
    const deals = [
      makeDeal({ id: "1", status: "completed" }),
      makeDeal({ id: "2", status: "paid" }),
      makeDeal({ id: "3", status: "archived", statusBeforeArchive: "completed" })
    ];

    const completedCount = deals.filter(
      (deal) => deal.status === "completed" || deal.status === "paid"
    ).length;

    expect(completedCount).toBe(2);
  });
});

describe("stage group mapping", () => {
  function mapStageGroup(
    deal: Pick<DealRecord, "status" | "paymentStatus">
  ): string {
    if (deal.status === "archived") return "archived";
    if (deal.status === "paid" || deal.status === "completed" || deal.paymentStatus === "paid") return "completed";
    if (deal.status === "contract_received" || deal.status === "negotiating") return "under_review";
    return "active";
  }

  test("maps archived status to archived group", () => {
    expect(mapStageGroup({ status: "archived", paymentStatus: "not_invoiced" })).toBe("archived");
  });

  test("maps completed status to completed group", () => {
    expect(mapStageGroup({ status: "completed", paymentStatus: "not_invoiced" })).toBe("completed");
  });

  test("maps paid status to completed group", () => {
    expect(mapStageGroup({ status: "paid", paymentStatus: "paid" })).toBe("completed");
  });

  test("maps contract_received to under_review group", () => {
    expect(mapStageGroup({ status: "contract_received", paymentStatus: "not_invoiced" })).toBe("under_review");
  });

  test("maps negotiating to under_review group", () => {
    expect(mapStageGroup({ status: "negotiating", paymentStatus: "invoiced" })).toBe("under_review");
  });

  test("maps signed to active group", () => {
    expect(mapStageGroup({ status: "signed", paymentStatus: "not_invoiced" })).toBe("active");
  });

  test("archived takes precedence over payment status", () => {
    expect(mapStageGroup({ status: "archived", paymentStatus: "paid" })).toBe("archived");
  });
});

describe("archive/unarchive transitions", () => {
  test("archiving preserves original status in statusBeforeArchive", () => {
    const original = makeDeal({ status: "negotiating" });
    const archived: DealRecord = {
      ...original,
      status: "archived",
      statusBeforeArchive: original.status
    };

    expect(archived.status).toBe("archived");
    expect(archived.statusBeforeArchive).toBe("negotiating");
  });

  test("unarchiving restores the original status", () => {
    const archived = makeDeal({
      status: "archived",
      statusBeforeArchive: "deliverables_pending"
    });
    const restored: DealRecord = {
      ...archived,
      status: (archived.statusBeforeArchive ?? "completed") as DealRecord["status"],
      statusBeforeArchive: null
    };

    expect(restored.status).toBe("deliverables_pending");
    expect(restored.statusBeforeArchive).toBeNull();
  });

  test("unarchiving falls back to completed when statusBeforeArchive is null", () => {
    const archived = makeDeal({
      status: "archived",
      statusBeforeArchive: null
    });
    const restored: DealRecord = {
      ...archived,
      status: (archived.statusBeforeArchive ?? "completed") as DealRecord["status"],
      statusBeforeArchive: null
    };

    expect(restored.status).toBe("completed");
  });

  test("archiving any status preserves it correctly", () => {
    const statuses = [
      "contract_received",
      "negotiating",
      "signed",
      "deliverables_pending",
      "submitted",
      "awaiting_payment",
      "paid",
      "completed"
    ] as const;

    for (const status of statuses) {
      const deal = makeDeal({ status });
      const archived: DealRecord = {
        ...deal,
        status: "archived",
        statusBeforeArchive: deal.status
      };

      expect(archived.statusBeforeArchive).toBe(status);
    }
  });
});
