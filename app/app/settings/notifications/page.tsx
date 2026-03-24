import { Suspense } from "react";

import { NotificationsSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications-view";
import { listNotificationsForViewer } from "@/lib/notification-service";

export default function NotificationsSettingsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  const viewer = await requireViewer();
  const notificationFeed = await listNotificationsForViewer(viewer);

  return <NotificationsView notifications={notificationFeed.notifications} />;
}
