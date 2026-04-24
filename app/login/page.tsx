import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CustomAuthScreen } from "@/components/custom-auth-screen";
import { getAppSettings } from "@/lib/admin-settings";
import { isE2EAuthEnabled, resolveE2EViewerFromCookies } from "@/lib/e2e-auth";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const [session, e2eViewer, appSettings] = await Promise.all([
    isE2EAuthEnabled() ? Promise.resolve(null) : auth(),
    resolveE2EViewerFromCookies(),
    getAppSettings(),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectPath = safeRedirectPath(resolvedSearchParams?.redirect);

  if (session?.userId || e2eViewer) {
    redirect(redirectPath);
  }

  return <CustomAuthScreen signUpsEnabled={appSettings.signUpsEnabled} />;
}
