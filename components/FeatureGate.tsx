"use client";

import { useFlags } from "launchdarkly-react-client-sdk";
import { type ReactNode } from "react";

type FeatureGateProps = {
  flagKey: string;
  defaultValue?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

export function FeatureGate({
  flagKey,
  defaultValue = false,
  children,
  fallback,
}: FeatureGateProps) {
  const flags = useFlags();
  const enabled = flags[flagKey as keyof typeof flags] ?? defaultValue;

  if (!enabled) {
    return fallback !== undefined ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
