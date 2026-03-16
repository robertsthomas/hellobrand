import { ProfileEditor } from "@/components/profile-editor";
import { requireViewer } from "@/lib/auth";
import { getProfileForViewer, listProfileAuditForViewer } from "@/lib/profile";

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const [profile, recentChanges] = await Promise.all([
    getProfileForViewer(viewer),
    listProfileAuditForViewer(viewer)
  ]);

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <ProfileEditor
          initialProfile={profile}
          initialEmail={viewer.email}
          initialAudit={recentChanges}
        />
      </div>
    </div>
  );
}
