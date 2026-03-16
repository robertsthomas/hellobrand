import { SettingsEditor } from "@/components/settings-editor";
import { requireViewer } from "@/lib/auth";
import { getProfileForViewer } from "@/lib/profile";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const profile = await getProfileForViewer(viewer);

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <SettingsEditor initialProfile={profile} initialEmail={viewer.email} />
      </div>
    </div>
  );
}
