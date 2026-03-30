import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CustomAuthScreen } from "@/components/custom-auth-screen";
import { getAppSettings } from "@/lib/admin-settings";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const [session, appSettings] = await Promise.all([
    auth(),
    getAppSettings()
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectPath = safeRedirectPath(resolvedSearchParams?.redirect);

  if (session.userId) {
    redirect(redirectPath);
  }

  return <CustomAuthScreen signUpsEnabled={appSettings.signUpsEnabled} />;
}
