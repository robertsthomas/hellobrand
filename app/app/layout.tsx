import type { ReactNode } from "react";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { AccentColorProvider } from "@/components/accent-color-provider";
import { AppFrame } from "@/components/app-frame";
import { PostHogUserIdentify } from "@/components/posthog-user-identify";

import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import {
  getCachedDealAggregates,
  getCachedOnboardingState,
  getCachedProfile,
} from "@/lib/cached-data";
import { getAppFeatureFlags } from "@/lib/feature-flags";
import { listEmailAccountsForViewer } from "@/lib/email/service";
import { listNotificationsForViewer } from "@/lib/notification-service";
import { buildSidebarMilestones } from "@/lib/sidebar-milestones";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const appSettings = await getAppSettings();

  if (!appSettings.appAccessEnabled) {
    return (
      <RuntimeStatusPage
        eyebrow="App paused"
        title="The creator app is temporarily unavailable."
        description="An admin has paused app access. Your account and data are still there, but the workspace is locked until the app is switched back on."
      />
    );
  }

  const [profile, onboardingState, dealAggregates, notificationFeed, entitlements, featureFlags] =
    await Promise.all([
      getCachedProfile(viewer),
      getCachedOnboardingState(viewer),
      getCachedDealAggregates(viewer),
      listNotificationsForViewer(viewer, {
        limit: 20,
        syncComputed: false,
      }),
      getViewerEntitlements(viewer),
      getAppFeatureFlags(),
    ]);
  const emailAccounts = entitlements.features.email_connections
    ? await listEmailAccountsForViewer(viewer)
    : [];
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  const isOnboardingComplete = !!onboardingState.profileOnboardingCompletedAt;
  const hasActiveWorkspace = dealAggregates.length > 0;
  const hasEverCreatedWorkspace =
    hasActiveWorkspace || onboardingState.productGuideStateJson.hasEverCreatedWorkspace;
  const notifications = notificationFeed.notifications;
  const sidebarMilestones = featureFlags.sidebarMilestones
    ? buildSidebarMilestones({
        hasActiveWorkspace,
        hasEverCreatedWorkspace,
        profile,
        entitlements,
        emailAccounts,
      })
    : undefined;

  return (
    <>
      <AccentColorProvider accentColor={profile.accentColor} />
      <PostHogUserIdentify
        userId={viewer.id}
        email={viewer.email}
        displayName={viewer.displayName}
      />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Suspense>
          <AppFrame
            viewerId={viewer.id}
            guideState={onboardingState.productGuideStateJson}
            hasActiveWorkspace={hasActiveWorkspace}
            hasEverCreatedWorkspace={hasEverCreatedWorkspace}
            notifications={notifications}
            onboardingComplete={isOnboardingComplete}
            sidebarMilestones={sidebarMilestones}
            featureFlags={featureFlags}
            workspaceNavItems={dealAggregates.map((aggregate) => {
              const labels = getDisplayDealLabels(aggregate.deal);

              return {
                dealId: aggregate.deal.id,
                label: labels.campaignName ?? aggregate.deal.campaignName,
                brandName: labels.brandName ?? aggregate.deal.brandName,
              };
            })}
          >
            {children}
          </AppFrame>
        </Suspense>
      </NextIntlClientProvider>
    </>
  );
}
