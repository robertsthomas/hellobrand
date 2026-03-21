import type { ReactNode } from "react";

import { AccentColorProvider } from "@/components/accent-color-provider";
import { AppFrame } from "@/components/app-frame";
import { requireViewer } from "@/lib/auth";
import { getCachedProfile } from "@/lib/cached-data";

export default async function WorkspaceLayout({
  children
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();
  const profile = await getCachedProfile(viewer);

  return (
    <>
      <AccentColorProvider accentColor={profile.accentColor} />
      <AppFrame>{children}</AppFrame>
    </>
  );
}
