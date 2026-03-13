import type { ReactNode } from "react";

import { AppFrame } from "@/components/app-frame";
import { requireViewer } from "@/lib/auth";

export default async function WorkspaceLayout({
  children
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();

  return <AppFrame viewer={viewer}>{children}</AppFrame>;
}
