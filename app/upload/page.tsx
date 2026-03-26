import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PublicUploadWorkspace } from "@/components/public-upload-workspace";

export default async function PublicUploadPage() {
  const session = await auth();

  if (session.userId) {
    redirect("/app/intake/new");
  }

  return <PublicUploadWorkspace />;
}
