"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

const e2eAuthEnabled = process.env.NEXT_PUBLIC_HELLOBRAND_E2E_AUTH === "1";

export function AuthProvider({ children }: { children: ReactNode }) {
  if (e2eAuthEnabled) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/login"
      waitlistUrl="/waitlist"
      appearance={{
        layout: {
          showOptionalFields: false,
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
