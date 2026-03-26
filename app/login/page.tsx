import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CustomAuthScreen } from "@/components/custom-auth-screen";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectPath = safeRedirectPath(resolvedSearchParams?.redirect);

  if (session.userId) {
    redirect(redirectPath);
  }

  return <CustomAuthScreen />;
}
