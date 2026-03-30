import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PublicUploadWorkspace } from "@/components/public-upload-workspace";
import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";

export default async function PublicUploadPage() {
  const [session, appSettings] = await Promise.all([
    auth(),
    getAppSettings()
  ]);

  if (session.userId) {
    redirect("/app/intake/new");
  }

  if (!appSettings.publicSiteEnabled) {
    return (
      <RuntimeStatusPage
        eyebrow="Uploads paused"
        title="Public uploads are turned off right now."
        description="An admin has paused public contract uploads. You can still sign in if you already have an account."
        actionHref="/login"
        actionLabel="Go to login"
      />
    );
  }

  return <PublicUploadWorkspace />;
}
