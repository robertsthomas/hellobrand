import { notFound } from "next/navigation";

import { DevDashboardClient } from "@/components/dev/dev-dashboard-client";
import {
  getDevDashboardSnapshot,
  getDevDashboardViewerFromSession,
  getRequestHost,
  isLocalDevelopmentRequest
} from "@/lib/dev-dashboard";

export default async function DevDashboardPage() {
  const host = await getRequestHost();

  if (!isLocalDevelopmentRequest(host)) {
    notFound();
  }

  const viewer = await getDevDashboardViewerFromSession();

  const snapshot = await getDevDashboardSnapshot();

  return <DevDashboardClient viewer={viewer} snapshot={snapshot} />;
}
