/**
 * This file renders the signed-in analytics page.
 * It connects the analytics UI to plan-gated data and supporting summaries without owning the analytics rules itself.
 */
import Link from "next/link";
import { Suspense } from "react";
import { PlanTier } from "@prisma/client";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import { FeatureUpgradeCard } from "@/components/feature-locked-state";
import { AnalyticsSkeleton } from "@/components/skeletons";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getCachedDealAggregates, getCachedProfile } from "@/lib/cached-data";
import { formatCurrency, humanizeToken } from "@/lib/utils";
import {
  buildAnalyticsViewModel,
  DUMMY_METRICS,
  DUMMY_MONTHS,
  DUMMY_TOP_CONTENT,
  getPlatformStatus,
} from "./page-helpers";

function AnalyticsPreviewLocked() {
  const maxVal = Math.max(...DUMMY_MONTHS.map((m) => m.value));

  return (
    <div className="relative px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px]">
        {/* Header */}
        <section className="flex flex-col gap-4 border-b border-black/[0.06] pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Analytics
              </p>
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Preview
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-foreground sm:text-4xl">
              Analytics
            </h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Sample data shown below — upgrade to see your real metrics.
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-4 py-2.5 text-sm font-medium text-muted-foreground">
            Last 6 months
          </div>
        </section>

        {/* Content with blur overlay */}
        <div className="relative mt-8">
          {/* Dummy metrics */}
          <div className="pointer-events-none select-none">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {DUMMY_METRICS.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-[#f7f5f1] px-4 py-4">
                  <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                    {metric.value}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white/90">
                    <div
                      className="h-full rounded-full bg-foreground/60"
                      style={{
                        width: `${metric.label === "Tracked revenue" ? 72 : metric.label === "Active partnerships" ? 52 : 34}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{metric.context}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="mt-8 border-t border-black/[0.06] pt-6">
              <div className="grid min-h-[260px] grid-cols-3 gap-4 sm:grid-cols-6">
                {DUMMY_MONTHS.map((item) => {
                  const height = `${Math.max((item.value / maxVal) * 160, 24)}px`;
                  const isPeak = item.value === maxVal;
                  return (
                    <div key={item.label} className="flex flex-col justify-end gap-3">
                      <div className="flex h-[190px] items-end justify-center rounded-lg bg-[#fbfaf7] px-3 pb-3">
                        <div
                          className={`w-10 rounded-sm ${isPeak ? "bg-foreground" : "bg-[#d9d4cc]"}`}
                          style={{ height }}
                        />
                      </div>
                      <div className="space-y-0.5 text-center">
                        <div className="text-sm font-medium text-foreground">
                          ${(item.value / 1000).toFixed(1)}k
                        </div>
                        <div className="text-sm text-muted-foreground">{item.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top content */}
            <div className="mt-8 border-t border-black/[0.06] pt-6">
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                Best performing content
              </h2>
              <div className="mt-4 divide-y divide-black/[0.06] border-t border-black/[0.06]">
                {DUMMY_TOP_CONTENT.map((item) => (
                  <div
                    key={item.campaign}
                    className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1fr)_100px_80px]"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.campaign}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {item.brand} · {item.status}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">Multi-platform</div>
                    <div className="text-right text-sm font-medium text-foreground">
                      {item.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Blur overlay with CTA */}
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-b from-white/40 via-white/70 to-white/90 backdrop-blur-[2px]">
            <div className="mx-4 max-w-md text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.06]">
                <BarChart3 className="h-6 w-6 text-foreground/60" />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
                Unlock analytics
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Revenue trends, partnership metrics, and payment timing analysis. See how your
                creator business is performing across all partnerships.
              </p>
              <div className="mt-5 flex items-center justify-center gap-4">
                <Link
                  href="/app/settings/billing"
                  className="group inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
                >
                  Upgrade to Standard
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}

async function AnalyticsContent() {
  const viewer = await requireViewer();
  const entitlements = await getViewerEntitlements(viewer);
  if (!entitlements.features.analytics) {
    return <AnalyticsPreviewLocked />;
  }

  const [aggregatesWithConflicts, profile] = await Promise.all([
    getCachedDealAggregates(viewer),
    getCachedProfile(viewer),
  ]);
  const { formattedTopContent, maxRevenuePoint, metadata, metrics, monthlyRevenue, platformRows } =
    buildAnalyticsViewModel(aggregatesWithConflicts, profile.payoutDetails);

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <section className="flex flex-col gap-4 border-b border-black/8 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Analytics
            </p>
            <h1 className="mt-3 text-3xl sm:text-[36px] lg:text-[44px] font-semibold tracking-[-0.06em] text-foreground">
              Analytics
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              A lightweight performance view for partnership value, payment timing, and creator
              channels linked to your profile.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 border border-black/8 bg-white px-4 py-3 text-sm font-medium text-foreground">
            Last 6 months
          </div>
        </section>

        <section className="grid gap-10 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-10">
            <section className="border-t border-black/8 pt-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[26px] font-semibold tracking-[-0.04em] text-foreground">
                    Engagement and growth metrics
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Simplified business metrics derived from your active partnership flow.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">Timeline view</div>
              </div>

              <div className="grid gap-4 border-t border-black/8 pt-5 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <div key={metric.label} className="bg-[#f7f5f1] px-4 py-4">
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                      {metric.value}
                    </p>
                    <div className="mt-3 h-2 bg-white/90">
                      <div
                        className="h-full bg-foreground"
                        style={{
                          width: `${Math.max(
                            metric.value === "0"
                              ? 8
                              : metric.label === "Tracked revenue"
                                ? 72
                                : metric.label === "Active partnerships"
                                  ? 52
                                  : metric.label === "Average partnership value"
                                    ? 46
                                    : 34,
                            8
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{metric.context}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-black/8 pt-6">
                <div className="grid min-h-[280px] grid-cols-3 sm:grid-cols-6 gap-4">
                  {monthlyRevenue.map((item, index) => {
                    const height = `${Math.max((item.value / maxRevenuePoint) * 180, 26)}px`;
                    const isPeak = item.value === maxRevenuePoint && item.value > 0;

                    return (
                      <div
                        key={`${item.label}-${index}`}
                        className="flex flex-col justify-end gap-4"
                      >
                        <div className="flex h-[210px] items-end justify-center bg-[#fbfaf7] px-3 pb-3">
                          <div className="flex h-full w-full items-end justify-center gap-1">
                            <div
                              className={isPeak ? "w-8 bg-foreground" : "w-8 bg-[#d9d4cc]"}
                              style={{ height }}
                            />
                            <div
                              className="w-8 border border-dashed border-black/8 bg-transparent"
                              style={{
                                height: `${Math.max(210 - Number.parseInt(height, 10), 26)}px`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1 text-center">
                          <div className="text-sm font-medium text-foreground">
                            {item.value > 0 ? formatCurrency(item.value) : "—"}
                          </div>
                          <div className="text-sm text-muted-foreground">{item.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="border-t border-black/8 pt-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-foreground">
                    Best performing content
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A simple list of top-value workspaces to keep this view useful without turning
                    analytics into the main product surface.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="border-b border-black/10 pb-1 text-foreground">
                    All platforms
                  </span>
                  <span>Instagram</span>
                  <span>TikTok</span>
                  <span>YouTube</span>
                </div>
              </div>

              <div className="divide-y divide-black/8 border-t border-black/8">
                {formattedTopContent.length === 0 ? (
                  <div className="py-5 text-sm text-muted-foreground">
                    No workspaces available yet.
                  </div>
                ) : (
                  formattedTopContent.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_110px_110px_96px]"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{item.campaignName}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {item.brandName} · {item.statusLabel}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.primaryPlatformLabel}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.nextDeliverableDateLabel}
                      </div>
                      <div className="text-right text-sm font-medium text-foreground">
                        {item.paymentAmountLabel}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-10">
            {!entitlements.features.analytics_advanced ? (
              <FeatureUpgradeCard
                eyebrow="Premium reporting"
                title="Advanced reporting is reserved for Premium"
                description="Standard includes the core partnership analytics view. Premium adds deeper reporting, connected inbox intelligence overlays, and future performance tracking."
                requiredTier={PlanTier.premium}
                currentTier={entitlements.effectiveTier}
                hasActiveSubscription={entitlements.hasActiveSubscription}
                actionLabel="Upgrade for advanced reporting"
              />
            ) : null}

            <section className="border-t border-black/8 pt-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-foreground">
                    Connected platform APIs
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Based on the creator handles saved in your profile.
                  </p>
                </div>
                <Link
                  href="/app/settings/profile"
                  className="inline-flex items-center gap-2 border border-black/8 bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[#f7f5f1]"
                >
                  Manage
                </Link>
              </div>

              <div className="divide-y divide-black/8 border-t border-black/8">
                {platformRows.map((entry) => {
                  const status = getPlatformStatus(entry.handle, entry.audienceLabel);

                  return (
                    <div key={entry.id} className="flex items-start justify-between gap-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-9 w-9 items-center justify-center bg-[#f7f5f1] text-foreground">
                          <SocialPlatformIcon platform={entry.platform} />
                        </div>
                        <div>
                          <div className="font-medium capitalize text-foreground">
                            {entry.platform}
                          </div>
                          <div className={`mt-1 text-sm ${status.tone}`}>{status.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {entry.handle || "Add your handle in profile to activate this surface."}
                          </div>
                        </div>
                      </div>

                      <Link
                        href="/app/settings/profile"
                        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium ${
                          entry.handle
                            ? "bg-foreground text-white"
                            : "border border-black/8 bg-white text-foreground"
                        } transition-colors hover:opacity-90`}
                      >
                        {entry.handle ? "Sync" : "Connect"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="border-t border-black/8 pt-6">
              <div className="mb-5">
                <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-foreground">
                  Account snapshot
                </h2>
              </div>

              <div className="divide-y divide-black/8 border-t border-black/8">
                <div className="flex items-start gap-3 py-4">
                  <BarChart3 className="mt-0.5 h-4 w-4 text-[#1A4D3E]" />
                  <div>
                    <div className="font-medium text-foreground">Primary platform</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {metadata.primaryPlatform
                        ? humanizeToken(metadata.primaryPlatform)
                        : "Not set"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#1A4D3E]" />
                  <div>
                    <div className="font-medium text-foreground">Content category</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {metadata.contentCategory ?? "Not set"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-4">
                  <CircleAlert className="mt-0.5 h-4 w-4 text-[#1A4D3E]" />
                  <div>
                    <div className="font-medium text-foreground">Business location</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {metadata.location ?? "Not set"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-4">
                  <RefreshCcw className="mt-0.5 h-4 w-4 text-[#1A4D3E]" />
                  <div>
                    <div className="font-medium text-foreground">Refresh cadence</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Manual for now. Use profile updates to keep channel data current.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
