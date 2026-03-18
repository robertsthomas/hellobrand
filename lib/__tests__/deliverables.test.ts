import { describe, expect, it } from "vitest";

import type { DeliverableItem } from "@/lib/types";
import {
  computeDeliverableProgress,
  isOverdue,
  nextDeadline
} from "@/lib/deliverables";

function makeDeliverable(overrides: Partial<DeliverableItem> = {}): DeliverableItem {
  return {
    id: "d-1",
    title: "Instagram Reel",
    dueDate: null,
    channel: "Instagram",
    quantity: 1,
    status: "pending",
    ...overrides
  };
}

describe("computeDeliverableProgress", () => {
  it("returns zeros for empty list", () => {
    const result = computeDeliverableProgress([]);
    expect(result).toEqual({
      total: 0,
      completed: 0,
      overdue: 0,
      inProgress: 0,
      pending: 0,
      percentComplete: 0
    });
  });

  it("counts statuses correctly", () => {
    const deliverables = [
      makeDeliverable({ id: "1", status: "completed" }),
      makeDeliverable({ id: "2", status: "in_progress" }),
      makeDeliverable({ id: "3", status: "overdue" }),
      makeDeliverable({ id: "4", status: "pending" })
    ];
    const result = computeDeliverableProgress(deliverables);
    expect(result.total).toBe(4);
    expect(result.completed).toBe(1);
    expect(result.inProgress).toBe(1);
    expect(result.overdue).toBe(1);
    expect(result.pending).toBe(1);
    expect(result.percentComplete).toBe(25);
  });

  it("treats missing status as pending", () => {
    const result = computeDeliverableProgress([
      makeDeliverable({ id: "1", status: undefined })
    ]);
    expect(result.pending).toBe(1);
  });

  it("computes 100% when all completed", () => {
    const deliverables = [
      makeDeliverable({ id: "1", status: "completed" }),
      makeDeliverable({ id: "2", status: "completed" })
    ];
    expect(computeDeliverableProgress(deliverables).percentComplete).toBe(100);
  });
});

describe("isOverdue", () => {
  it("returns false for null date", () => {
    expect(isOverdue(null)).toBe(false);
  });

  it("returns true for past date", () => {
    expect(isOverdue("2020-01-01")).toBe(true);
  });

  it("returns false for future date", () => {
    expect(isOverdue("2099-12-31")).toBe(false);
  });

  it("returns false for invalid date string", () => {
    expect(isOverdue("not-a-date")).toBe(false);
  });
});

describe("nextDeadline", () => {
  it("returns null for empty list", () => {
    expect(nextDeadline([])).toBeNull();
  });

  it("returns null when no due dates", () => {
    expect(nextDeadline([makeDeliverable()])).toBeNull();
  });

  it("returns earliest non-completed due date", () => {
    const deliverables = [
      makeDeliverable({ id: "1", dueDate: "2026-06-15", status: "pending" }),
      makeDeliverable({ id: "2", dueDate: "2026-03-01", status: "in_progress" }),
      makeDeliverable({ id: "3", dueDate: "2026-01-01", status: "completed" })
    ];
    expect(nextDeadline(deliverables)).toBe("2026-03-01");
  });

  it("skips completed deliverables", () => {
    const deliverables = [
      makeDeliverable({ id: "1", dueDate: "2026-01-01", status: "completed" }),
      makeDeliverable({ id: "2", dueDate: "2026-06-01", status: "pending" })
    ];
    expect(nextDeadline(deliverables)).toBe("2026-06-01");
  });
});
