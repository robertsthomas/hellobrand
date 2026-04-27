"use client";

import { LDProvider } from "launchdarkly-react-client-sdk";
import { type ReactNode } from "react";

function getClientSideId() {
  return process.env.NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_SIDE_ID?.trim() || "";
}

export function LaunchDarklyProvider({ children }: { children: ReactNode }) {
  const clientSideId = getClientSideId();

  if (!clientSideId) {
    return <>{children}</>;
  }

  return (
    <LDProvider
      clientSideID={clientSideId}
      context={{ kind: "user", key: "anonymous", anonymous: true }}
      options={{ sendEventsOnlyForVariation: true }}
    >
      {children}
    </LDProvider>
  );
}
