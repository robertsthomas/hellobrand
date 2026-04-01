import type { ReactNode } from "react";

import { AccentColorProvider } from "@/components/accent-color-provider";
import { AppFrame } from "@/components/app-frame";
import { PostHogUserIdentify } from "@/components/posthog-user-identify";

import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { requireViewer } from "@/lib/auth";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import {
  getCachedDealAggregates,
  getCachedOnboardingState,
  getCachedProfile
} from "@/lib/cached-data";
import { listNotificationsForViewer } from "@/lib/notification-service";

export default async function WorkspaceLayout({
  children
}: {
  children: ReactNode;
}) {
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

  const [profile, onboardingState, dealAggregates, notificationFeed] = await Promise.all([
    getCachedProfile(viewer),
    getCachedOnboardingState(viewer),
    getCachedDealAggregates(viewer),
    listNotificationsForViewer(viewer)
  ]);

  const isOnboardingComplete =
    !!onboardingState.profileOnboardingCompletedAt;
  const hasActiveWorkspace = dealAggregates.length > 0;
  const notifications = notificationFeed.notifications;

  return (
    <>
      <AccentColorProvider accentColor={profile.accentColor} />
      <PostHogUserIdentify
        userId={viewer.id}
        email={viewer.email}
        displayName={viewer.displayName}
      />
      <AppFrame
        guideState={onboardingState.productGuideStateJson}
        hasActiveWorkspace={hasActiveWorkspace}
        notifications={notifications}
        onboardingComplete={isOnboardingComplete}
        workspaceNavItems={dealAggregates.map((aggregate) => {
          const labels = getDisplayDealLabels(aggregate.deal);

          return {
            dealId: aggregate.deal.id,
            label: labels.campaignName ?? aggregate.deal.campaignName,
            brandName: labels.brandName ?? aggregate.deal.brandName
          };
        })}
      >
        {children}
      </AppFrame>
    </>
  );
}
