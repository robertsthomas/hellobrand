import { Suspense } from "react";

import { NotificationsSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { getCachedDealAggregates } from "@/lib/cached-data";
import { NotificationsView } from "@/components/notifications-view";
import { generateNotifications } from "@/lib/notifications";

export default function NotificationsSettingsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  const viewer = await requireViewer();
  const aggregates = await getCachedDealAggregates(viewer);
  const notifications = generateNotifications(aggregates);

  return <NotificationsView notifications={notifications} />;
}
