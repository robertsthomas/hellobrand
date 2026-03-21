import type {
  ConflictResult,
  DealAggregate,
  EmailMessageRecord
} from "@/lib/types";
import { buildConflictResults } from "@/lib/conflict-intelligence";

/**
 * Checks whether a newly extracted email term (e.g., exclusivity mention)
 * creates conflicts against the creator's other active deals.
 *
 * This is structurally impossible for brand-side tools — they only see
 * one brand's data. HelloBrand sees ALL of a creator's deals.
 */
export function checkCrossDealConflicts(
  targetAggregate: DealAggregate,
  allAggregates: DealAggregate[],
  message: EmailMessageRecord
): ConflictResult[] {
  const text = (message.textBody ?? "").replace(/\s+/g, " ").toLowerCase();
  if (!text || text.length < 20) {
    return [];
  }

  // Only trigger cross-deal checks when the email discusses terms that
  // could conflict: exclusivity, scheduling, or category restrictions
  const hasExclusivitySignal = /\b(exclusiv|non-?compete|restrict|category)\b/i.test(text);
  const hasScheduleSignal = /\b(deadline|due|schedule|booking|window|blackout|posting\s+date)\b/i.test(text);
  const hasRightsSignal = /\b(usage|rights|license|whitelist|territory)\b/i.test(text);

  if (!hasExclusivitySignal && !hasScheduleSignal && !hasRightsSignal) {
    return [];
  }

  // Use the existing conflict intelligence engine
  const others = allAggregates.filter(
    (a) => a.deal.id !== targetAggregate.deal.id
  );

  if (others.length === 0) {
    return [];
  }

  const conflicts = buildConflictResults(targetAggregate, others);

  // Tag conflicts with email source context
  return conflicts.map((conflict) => ({
    ...conflict,
    evidenceRefs: [
      ...conflict.evidenceRefs,
      `Triggered by email: "${message.subject}" from ${message.from?.email ?? "unknown"}`
    ]
  }));
}
