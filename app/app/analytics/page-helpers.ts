/**
 * Helpers for the analytics route.
 * This file keeps analytics-specific metric shaping, chart data, platform status, and preview data out of the route component.
 */
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { parseProfileMetadata, type ProfilePlatform } from "@/lib/profile-metadata";
import type { DealAggregate } from "@/lib/types";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

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
  const safeAggregates = aggregatesWithConflicts as DealAggregate[];
  const totalRevenue = safeAggregates.reduce(
    (sum, aggregate) => sum + (aggregate?.terms?.paymentAmount ?? 0),
    0
  );
  const activePartnershipsCount = safeAggregates.filter(
    (aggregate) =>
      aggregate?.deal.status !== "completed" && aggregate?.deal.status !== "paid"
  ).length;
  const awaitingPaymentCount = safeAggregates.filter(
    (aggregate) =>
      aggregate?.deal.paymentStatus === "awaiting_payment" ||
      aggregate?.deal.paymentStatus === "late"
  ).length;
  const averageDealSize = safeAggregates.length
    ? Math.round(totalRevenue / safeAggregates.length)
    : 0;

  const sixMonthWindow = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return date;
  });

  const monthlyRevenue = sixMonthWindow.map((date) => {
    const key = monthKey(date);
    const value = safeAggregates.reduce((sum, aggregate) => {
      const sourceDate =
        aggregate?.deal.confirmedAt ??
        aggregate?.deal.analyzedAt ??
        aggregate?.deal.createdAt;

      if (!sourceDate) {
        return sum;
      }

      const current = new Date(sourceDate);
      return monthKey(current) === key
        ? sum + (aggregate?.terms?.paymentAmount ?? 0)
        : sum;
    }, 0);

    return {
      label: monthLabel(date),
      value
    };
  });

  const maxRevenuePoint = Math.max(...monthlyRevenue.map((item) => item.value), 1);

  const topContent = safeAggregates
    .slice()
    .sort(
      (left, right) =>
        (right?.terms?.paymentAmount ?? 0) - (left?.terms?.paymentAmount ?? 0)
    )
    .slice(0, 5);

  const { metadata } = parseProfileMetadata(payoutDetails);
  const platformRows: Array<{
    id: string;
    platform: ProfilePlatform;
    handle: string;
    audienceLabel: string | null;
    partnershipContext: string | null;
  }> =
    metadata.socialHandles.length > 0
      ? metadata.socialHandles
      : [
          { id: "instagram", platform: "instagram", handle: "", audienceLabel: null, partnershipContext: null },
          { id: "tiktok", platform: "tiktok", handle: "", audienceLabel: null, partnershipContext: null },
          { id: "youtube", platform: "youtube", handle: "", audienceLabel: null, partnershipContext: null }
        ];

  const metrics = [
    {
      label: "Tracked revenue",
      value: formatCurrency(totalRevenue),
      context: `${safeAggregates.length} total workspaces`
    },
    {
      label: "Active partnerships",
      value: String(activePartnershipsCount),
      context: "Currently in progress"
    },
    {
      label: "Average partnership value",
      value: formatCurrency(averageDealSize),
      context: "Across confirmed values"
    },
    {
      label: "Awaiting payment",
      value: String(awaitingPaymentCount),
      context: "Needs invoice follow-up"
    }
  ];

  const formattedTopContent = topContent.map((aggregate) => {
    const labels = getDisplayDealLabels(aggregate.deal);

    return {
      id: aggregate.deal.id,
      campaignName: labels.campaignName ?? aggregate.deal.campaignName,
      brandName: labels.brandName ?? aggregate.deal.brandName,
      statusLabel: humanizeToken(aggregate.deal.status),
      primaryPlatformLabel: metadata.primaryPlatform
        ? humanizeToken(metadata.primaryPlatform)
        : "Platform",
      nextDeliverableDateLabel: formatDate(aggregate.deal.nextDeliverableDate),
      paymentAmountLabel: formatCurrency(aggregate.terms?.paymentAmount ?? 0)
    };
  });

  return {
    formattedTopContent,
    maxRevenuePoint,
    metadata,
    metrics,
    monthlyRevenue,
    platformRows
  };
}
