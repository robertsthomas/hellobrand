import { Suspense } from "react";

import { SettingsEditor } from "@/components/settings-editor";
import { requireViewer } from "@/lib/auth";
import { getCachedProfile } from "@/lib/cached-data";


export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="px-8 py-10"><div className="mx-auto max-w-5xl animate-pulse space-y-4"><div className="h-10 w-48 rounded bg-black/[0.06]" /><div className="h-96 w-full rounded bg-black/[0.06]" /></div></div>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const viewer = await requireViewer();
  const profile = await getCachedProfile(viewer);

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <SettingsEditor initialProfile={profile} initialEmail={viewer.email} />
      </div>
    </div>
  );
}
