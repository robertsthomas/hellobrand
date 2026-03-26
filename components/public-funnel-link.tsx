"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { trackPublicFunnelEvent, type PublicFunnelEventName } from "@/lib/public-funnel-events";

export function PublicFunnelLink({
  href,
  eventName,
  payload,
  className,
  children
}: {
  href: string;
  eventName: PublicFunnelEventName;
  payload?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackPublicFunnelEvent(eventName, payload)}
    >
      {children}
    </Link>
  );
}
