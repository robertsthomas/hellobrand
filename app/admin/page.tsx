import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { getAdminDashboardSnapshot } from "@/lib/admin-dashboard";
import { requireAdminViewer } from "@/lib/admin-auth";

export default async function AdminDashboardPage() {
  const admin = await requireAdminViewer();
  const snapshot = await getAdminDashboardSnapshot();

  return (
    <AdminDashboardClient
      adminUsername={admin.username}
      snapshot={snapshot}
    />
  );
}
