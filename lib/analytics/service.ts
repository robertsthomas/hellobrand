import { getCachedDealAggregates, getCachedProfile } from "@/lib/cached-data";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { parseProfileMetadata, type SocialHandleEntry } from "@/lib/profile-metadata";
import type { DealAggregate, Viewer } from "@/lib/types";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

export type AnalyticsRange = "30d" | "90d" | "180d" | "365d" | "all";

export interface AnalyticsSnapshotOptions {
  range?: AnalyticsRange;
  brandNames?: string[];
  statuses?: string[];
  includeArchived?: boolean;
  now?: Date;
  topContentLimit?: number;
}

export interface AnalyticsMetricSnapshot {
  key: string;
  label: string;
  value: string;
  context: string;
}

export interface AnalyticsRevenuePoint {
  label: string;
  value: number;
}

export interface AnalyticsTopContentSnapshot {
  id: string;
  campaignName: string;
  brandName: string;
  statusLabel: string;
  primaryPlatformLabel: string;
  nextDeliverableDateLabel: string;
  paymentAmountLabel: string;
}

export interface AnalyticsPipelineSnapshot {
  key: string;
  label: string;
  count: number;
  revenue: number;
}

export interface AnalyticsPaymentHealthSnapshot {
  averagePaymentDays: number | null;
  averageConfirmationDays: number | null;
  overdueCount: number;
  paidCount: number;
  awaitingCount: number;
}

export interface AnalyticsSnapshot {
  appliedRange: AnalyticsRange;
  totalDeals: number;
  metrics: AnalyticsMetricSnapshot[];
  monthlyRevenue: AnalyticsRevenuePoint[];
  maxRevenuePoint: number;
  formattedTopContent: AnalyticsTopContentSnapshot[];
  metadata: ReturnType<typeof parseProfileMetadata>["metadata"];
  platformRows: ReturnType<typeof parseProfileMetadata>["metadata"]["socialHandles"];
  paymentHealth: AnalyticsPaymentHealthSnapshot;
  pipelineBreakdown: AnalyticsPipelineSnapshot[];
  availableBrands: string[];
  availableStatuses: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

function rangeCutoff(range: AnalyticsRange, now: Date) {
  if (range === "all") {
    return null;
  }

  const days = range === "30d" ? 30 : range === "90d" ? 90 : range === "365d" ? 365 : 180;
  return new Date(now.getTime() - days * DAY_MS);
}

function monthsForRange(range: AnalyticsRange) {
  switch (range) {
    case "30d":
      return 2;
    case "90d":
      return 3;
    case "365d":
      return 12;
    case "all":
      return 12;
    default:
      return 6;
  }
}

function dealValue(aggregate: DealAggregate) {
  return (
    aggregate.terms?.paymentAmount ??
    aggregate.paymentRecord?.amount ??
    aggregate.invoiceRecord?.subtotal ??
    0
  );
}

function revenueDate(aggregate: DealAggregate) {
  return (
    parseDate(aggregate.paymentRecord?.paidDate) ??
    parseDate(aggregate.invoiceRecord?.sentAt) ??
    parseDate(aggregate.invoiceRecord?.finalizedAt) ??
    parseDate(aggregate.invoiceRecord?.invoiceDate) ??
    parseDate(aggregate.deal.confirmedAt) ??
    parseDate(aggregate.deal.analyzedAt) ??
    parseDate(aggregate.deal.createdAt)
  );
}

function activityDate(aggregate: DealAggregate) {
  return (
    parseDate(aggregate.deal.updatedAt) ??
    revenueDate(aggregate) ??
    parseDate(aggregate.deal.createdAt)
  );
}

function statusGroup(aggregate: DealAggregate) {
  if (aggregate.deal.status === "archived") {
    return "archived";
  }

  if (
    aggregate.deal.status === "paid" ||
    aggregate.deal.status === "completed" ||
    aggregate.deal.paymentStatus === "paid"
  ) {
    return "completed";
  }

  if (
    aggregate.deal.paymentStatus === "awaiting_payment" ||
    aggregate.deal.paymentStatus === "late"
  ) {
    return "awaiting_payment";
  }

  if (
    aggregate.deal.status === "contract_received" ||
    aggregate.deal.status === "negotiating"
  ) {
    return "under_review";
  }

  return "active";
}

function withinRange(date: Date | null, range: AnalyticsRange, now: Date) {
  const cutoff = rangeCutoff(range, now);
  if (!cutoff || !date) {
    return true;
  }

  return date.getTime() >= cutoff.getTime();
}

function monthlyRevenueSeries(
  aggregates: DealAggregate[],
  range: AnalyticsRange,
  now: Date
): AnalyticsRevenuePoint[] {
  const months = monthsForRange(range);

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now);
    date.setDate(1);
    date.setMonth(date.getMonth() - (months - 1 - index));
    const key = monthKey(date);

    return {
      label: monthLabel(date),
      value: aggregates.reduce((sum, aggregate) => {
        const sourceDate = revenueDate(aggregate);
        if (!sourceDate || monthKey(sourceDate) !== key) {
          return sum;
        }

        return sum + dealValue(aggregate);
      }, 0),
    };
  });
}

function buildPipelineBreakdown(aggregates: DealAggregate[]): AnalyticsPipelineSnapshot[] {
  const keys = [
    { key: "under_review", label: "Under review" },
    { key: "active", label: "Active" },
    { key: "awaiting_payment", label: "Awaiting payment" },
    { key: "completed", label: "Completed" },
    { key: "archived", label: "Archived" },
  ] as const;

  return keys.map((entry) => {
    const matching = aggregates.filter((aggregate) => statusGroup(aggregate) === entry.key);

    return {
      key: entry.key,
      label: entry.label,
      count: matching.length,
      revenue: matching.reduce((sum, aggregate) => sum + dealValue(aggregate), 0),
    };
  });
}

function buildPaymentHealth(aggregates: DealAggregate[]): AnalyticsPaymentHealthSnapshot {
  const paymentDurations = aggregates.flatMap((aggregate) => {
    const paidAt = parseDate(aggregate.paymentRecord?.paidDate);
    const invoiceAt =
      parseDate(aggregate.paymentRecord?.invoiceDate) ??
      parseDate(aggregate.invoiceRecord?.invoiceDate) ??
      parseDate(aggregate.invoiceRecord?.sentAt) ??
      parseDate(aggregate.invoiceRecord?.createdAt);

    if (!paidAt || !invoiceAt) {
      return [];
    }

    return [Math.max(Math.round((paidAt.getTime() - invoiceAt.getTime()) / DAY_MS), 0)];
  });

  const confirmationDurations = aggregates.flatMap((aggregate) => {
    const confirmedAt = parseDate(aggregate.deal.confirmedAt);
    const createdAt = parseDate(aggregate.deal.createdAt);

    if (!confirmedAt || !createdAt) {
      return [];
    }

    return [Math.max(Math.round((confirmedAt.getTime() - createdAt.getTime()) / DAY_MS), 0)];
  });

  return {
    averagePaymentDays: average(paymentDurations),
    averageConfirmationDays: average(confirmationDurations),
    overdueCount: aggregates.filter((aggregate) => aggregate.deal.paymentStatus === "late").length,
    paidCount: aggregates.filter((aggregate) => aggregate.deal.paymentStatus === "paid").length,
    awaitingCount: aggregates.filter((aggregate) =>
      aggregate.deal.paymentStatus === "awaiting_payment" ||
      aggregate.deal.paymentStatus === "late"
    ).length,
  };
}

export function buildAnalyticsSnapshot(
  aggregates: DealAggregate[],
  payoutDetails: string | null,
  options: AnalyticsSnapshotOptions = {}
): AnalyticsSnapshot {
  const range = options.range ?? "180d";
  const now = options.now ?? new Date();
  const requestedBrands = new Set(
    (options.brandNames ?? []).map((brand) => brand.trim().toLowerCase()).filter(Boolean)
  );
  const requestedStatuses = new Set(
    (options.statuses ?? []).map((status) => status.trim().toLowerCase()).filter(Boolean)
  );

  const availableBrands = [...new Set(aggregates.map((aggregate) => aggregate.deal.brandName))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const availableStatuses = [...new Set(aggregates.map((aggregate) => aggregate.deal.status))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const filteredAggregates = aggregates.filter((aggregate) => {
    if (!options.includeArchived && aggregate.deal.status === "archived") {
      return false;
    }

    if (requestedBrands.size > 0) {
      const brandName = aggregate.deal.brandName.trim().toLowerCase();
      if (!requestedBrands.has(brandName)) {
        return false;
      }
    }

    if (requestedStatuses.size > 0) {
      const currentStatus = aggregate.deal.status.trim().toLowerCase();
      if (!requestedStatuses.has(currentStatus)) {
        return false;
      }
    }

    return withinRange(activityDate(aggregate), range, now);
  });

  const totalRevenue = filteredAggregates.reduce((sum, aggregate) => sum + dealValue(aggregate), 0);
  const activePartnershipsCount = filteredAggregates.filter((aggregate) => {
    const group = statusGroup(aggregate);
    return group !== "completed" && group !== "archived";
  }).length;
  const awaitingPaymentCount = filteredAggregates.filter(
    (aggregate) => statusGroup(aggregate) === "awaiting_payment"
  ).length;
  const averageDealSize = filteredAggregates.length
    ? Math.round(totalRevenue / filteredAggregates.length)
    : 0;

  const monthlyRevenue = monthlyRevenueSeries(filteredAggregates, range, now);
  const maxRevenuePoint = Math.max(...monthlyRevenue.map((item) => item.value), 1);
  const { metadata } = parseProfileMetadata(payoutDetails);
  const platformRows: SocialHandleEntry[] =
    metadata.socialHandles.length > 0
      ? metadata.socialHandles
      : [
          {
            id: "instagram",
            platform: "instagram",
            handle: "",
            audienceLabel: null,
            partnershipContext: null,
          },
          {
            id: "tiktok",
            platform: "tiktok",
            handle: "",
            audienceLabel: null,
            partnershipContext: null,
          },
          {
            id: "youtube",
            platform: "youtube",
            handle: "",
            audienceLabel: null,
            partnershipContext: null,
          },
        ];

  const formattedTopContent = filteredAggregates
    .slice()
    .sort((left, right) => dealValue(right) - dealValue(left))
    .slice(0, Math.max(options.topContentLimit ?? 5, 1))
    .map((aggregate) => {
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
        paymentAmountLabel: formatCurrency(dealValue(aggregate)),
      };
    });

  const paymentHealth = buildPaymentHealth(filteredAggregates);
  const metrics: AnalyticsMetricSnapshot[] = [
    {
      key: "tracked_revenue",
      label: "Tracked revenue",
      value: formatCurrency(totalRevenue),
      context: `${filteredAggregates.length} total workspaces`,
    },
    {
      key: "active_partnerships",
      label: "Active partnerships",
      value: String(activePartnershipsCount),
      context: `${buildPipelineBreakdown(filteredAggregates).find((item) => item.key === "under_review")?.count ?? 0} under review`,
    },
    {
      key: "average_partnership_value",
      label: "Average partnership value",
      value: formatCurrency(averageDealSize),
      context:
        paymentHealth.averageConfirmationDays === null
          ? "Across confirmed values"
          : `${paymentHealth.averageConfirmationDays} days avg. to confirm`,
    },
    {
      key: "awaiting_payment",
      label: "Awaiting payment",
      value: String(awaitingPaymentCount),
      context:
        paymentHealth.overdueCount > 0
          ? `${paymentHealth.overdueCount} overdue`
          : paymentHealth.averagePaymentDays === null
            ? "No completed payment cycles yet"
            : `${paymentHealth.averagePaymentDays} days avg. to payment`,
    },
  ];

  return {
    appliedRange: range,
    totalDeals: filteredAggregates.length,
    metrics,
    monthlyRevenue,
    maxRevenuePoint,
    formattedTopContent,
    metadata,
    platformRows,
    paymentHealth,
    pipelineBreakdown: buildPipelineBreakdown(filteredAggregates),
    availableBrands,
    availableStatuses,
  };
}

export async function getAnalyticsSnapshotForViewer(
  viewer: Viewer,
  options?: AnalyticsSnapshotOptions
) {
  const [aggregates, profile] = await Promise.all([
    getCachedDealAggregates(viewer),
    getCachedProfile(viewer),
  ]);

  return buildAnalyticsSnapshot(aggregates, profile.payoutDetails, options);
}
