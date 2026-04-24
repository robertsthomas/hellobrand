/**
 * Helpers for the analytics route.
 * This file keeps analytics-specific metric shaping, chart data, platform status, and preview data out of the route component.
 */
import { buildAnalyticsSnapshot } from "@/lib/analytics/service";
import type { ProfilePlatform } from "@/lib/profile-metadata";
import type { DealAggregate } from "@/lib/types";

export function getPlatformStatus(handle: string, audienceLabel: string | null) {
  if (!handle) {
    return {
      label: "Not connected",
      tone: "text-[#d96c4f]"
    };
  }

  return {
    label: audienceLabel ?? "Connected",
    tone: "text-[#1A4D3E]"
  };
}

export const DUMMY_METRICS = [
  { label: "Tracked revenue", value: "$24,800", context: "12 total workspaces" },
  { label: "Active partnerships", value: "5", context: "Currently in progress" },
  { label: "Average partnership value", value: "$2,067", context: "Across confirmed values" },
  { label: "Awaiting payment", value: "2", context: "Needs invoice follow-up" }
];

export const DUMMY_MONTHS = [
  { label: "Oct", value: 1200 },
  { label: "Nov", value: 3400 },
  { label: "Dec", value: 5800 },
  { label: "Jan", value: 4200 },
  { label: "Feb", value: 7600 },
  { label: "Mar", value: 2600 }
];

export const DUMMY_TOP_CONTENT = [
  { brand: "Glossier", campaign: "Spring Collection Launch", status: "In progress", amount: "$8,500" },
  { brand: "Nike", campaign: "Athlete Stories Series", status: "Confirmed", amount: "$6,200" },
  { brand: "Spotify", campaign: "Playlist Takeover", status: "Completed", amount: "$4,500" },
  { brand: "Adobe", campaign: "Creative Suite Ambassador", status: "In progress", amount: "$3,800" },
  { brand: "Fenty Beauty", campaign: "Product Launch Campaign", status: "Confirmed", amount: "$1,800" }
];

export function buildAnalyticsViewModel(
  aggregatesWithConflicts: DealAggregate[],
  payoutDetails: string | null
) {
  const snapshot = buildAnalyticsSnapshot(aggregatesWithConflicts, payoutDetails);

  return {
    formattedTopContent: snapshot.formattedTopContent,
    maxRevenuePoint: snapshot.maxRevenuePoint,
    metadata: snapshot.metadata,
    metrics: snapshot.metrics,
    monthlyRevenue: snapshot.monthlyRevenue,
    platformRows: snapshot.platformRows as Array<{
      id: string;
      platform: ProfilePlatform;
      handle: string;
      audienceLabel: string | null;
      partnershipContext: string | null;
    }>
  };
}
