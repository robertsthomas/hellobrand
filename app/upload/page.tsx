import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PublicUploadWorkspace } from "@/components/public-upload-workspace";
import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { absoluteUrl, siteConfig } from "@/lib/site";

const uploadTitle = "Upload a Brand Deal Contract — Free Analysis | HelloBrand";
const uploadDescription =
  "Upload any brand partnership contract and get a free plain-English breakdown with risk flags, deliverables, and payment terms. No signup required.";

export const metadata: Metadata = {
  title: uploadTitle,
  description: uploadDescription,
  alternates: {
    canonical: "/upload",
  },
  openGraph: {
    title: uploadTitle,
    description: uploadDescription,
    url: absoluteUrl("/upload"),
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: uploadTitle,
    description: uploadDescription,
  },
};

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
