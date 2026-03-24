import type { ReactNode } from "react";

import { AccentColorProvider } from "@/components/accent-color-provider";
import { AppFrame } from "@/components/app-frame";
import { ProfileOnboardingModal } from "@/components/onboarding/profile-onboarding-modal";
import { requireViewer } from "@/lib/auth";
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

  // Show full-screen onboarding flow instead of the app
  if (!isOnboardingComplete) {
    return (
      <ProfileOnboardingModal
        viewer={{
          id: viewer.id,
          email: viewer.email,
          displayName: viewer.displayName
        }}
      />
    );
  }

  return (
    <>
      <AccentColorProvider accentColor={profile.accentColor} />
      <AppFrame
        guideState={onboardingState.productGuideStateJson}
        hasActiveWorkspace={hasActiveWorkspace}
        notifications={notifications}
        onboardingComplete
      >
        {children}
      </AppFrame>
    </>
  );
}
