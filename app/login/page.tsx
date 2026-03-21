import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CustomAuthScreen } from "@/components/custom-auth-screen";

export default async function LoginPage() {
  const session = await auth();

  if (session.userId) {
    redirect("/app");
  }

  return <CustomAuthScreen />;
}
