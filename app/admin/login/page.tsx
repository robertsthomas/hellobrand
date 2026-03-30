import { redirect } from "next/navigation";

import { AdminAuthScreen } from "@/components/admin/admin-auth-screen";
import { getAdminUsername, getAdminViewer, isAdminConfigured } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  const [viewer, configured] = await Promise.all([
    getAdminViewer(),
    isAdminConfigured()
  ]);

  if (viewer) {
    redirect("/admin");
  }

  return (
    <AdminAuthScreen
      configured={configured}
      username={getAdminUsername()}
    />
  );
}
