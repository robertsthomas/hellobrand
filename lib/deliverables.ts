import type { DeliverableItem } from "@/lib/types";

export type DeliverableStatus = NonNullable<DeliverableItem["status"]>;

export const DELIVERABLE_STATUSES: DeliverableStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "overdue"
];

export function computeDeliverableProgress(deliverables: DeliverableItem[]) {
  const total = deliverables.length;
  if (total === 0) {
    return { total: 0, completed: 0, overdue: 0, inProgress: 0, pending: 0, percentComplete: 0 };
  }

  const completed = deliverables.filter((d) => d.status === "completed").length;
  const overdue = deliverables.filter((d) => d.status === "overdue").length;
  const inProgress = deliverables.filter((d) => d.status === "in_progress").length;
  const pending = deliverables.filter((d) => !d.status || d.status === "pending").length;
  const percentComplete = Math.round((completed / total) * 100);

  return { total, completed, overdue, inProgress, pending, percentComplete };
}

export function nextDeadline(deliverables: DeliverableItem[]): string | null {
  const upcoming = deliverables
    .filter((d) => d.dueDate && d.status !== "completed")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  return upcoming[0]?.dueDate ?? null;
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}
