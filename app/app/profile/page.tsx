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
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Profile</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Manage creator identity, workflow defaults, and reminder preferences used
            across intake, workspaces, and AI-generated drafts.
          </p>
        </section>

        <ProfileEditor
          initialProfile={profile}
          initialEmail={viewer.email}
          initialAudit={recentChanges}
        />
      </div>
    </div>
  );
}
