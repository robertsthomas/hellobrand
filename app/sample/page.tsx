import type { Metadata } from "next";

import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { PublicSampleExperience } from "@/components/public-sample-experience";
import { absoluteUrl, siteConfig } from "@/lib/site";

const sampleTitle = "Try a Sample Contract Breakdown | HelloBrand";
const sampleDescription =
  "See how HelloBrand breaks down a brand deal contract into plain English: risks, deliverables, and payment terms. Try a sample contract for free.";

export const metadata: Metadata = {
  title: sampleTitle,
  description: sampleDescription,
  alternates: {
    canonical: "/sample",
  },
  openGraph: {
    title: sampleTitle,
    description: sampleDescription,
    url: absoluteUrl("/sample"),
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: sampleTitle,
    description: sampleDescription,
  },
};

export default async function SampleContractPage() {
  const appSettings = await getAppSettings();

  if (!appSettings.publicSiteEnabled) {
    return (
      <RuntimeStatusPage
        eyebrow="Sample experience paused"
        title="Sample contract previews are unavailable."
        description="Public access is paused at the moment, so the sample walkthrough is hidden until an admin turns it back on."
        actionHref="/login"
        actionLabel="Go to login"
      />
    );
  }

  return <PublicSampleExperience />;
}
