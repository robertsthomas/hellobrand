import { Suspense } from "react";

import { ProfileEditor } from "@/components/profile-editor";
import { ProfileSkeleton } from "@/components/skeletons";
import { requireViewer } from "@/lib/auth";
import { getCachedProfile, getCachedProfileAudit } from "@/lib/cached-data";


export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const viewer = await requireViewer();
  const [profile, recentChanges] = await Promise.all([
    getCachedProfile(viewer),
    getCachedProfileAudit(viewer)
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
