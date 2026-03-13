"use client";

import type { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";

export function Show({
  when,
  children
}: {
  when: "signed-in" | "signed-out";
  children: ReactNode;
}) {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (when === "signed-in") {
    return userId ? <>{children}</> : null;
  }

  return userId ? null : <>{children}</>;
}
