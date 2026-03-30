import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { PublicSampleExperience } from "@/components/public-sample-experience";

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
