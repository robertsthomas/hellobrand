"use client";

import Link from "next/link";
import type { ComponentProps, MouseEventHandler, ReactNode } from "react";
import { usePostHog } from "posthog-js/react";

import { captureAppEvent, type AppActionEventName } from "@/lib/posthog/events";

type LinkProps = Omit<ComponentProps<typeof Link>, "href" | "children">;

export function PostHogActionLink({
  href,
  eventName,
  payload,
  onClick,
  children,
  ...props
}: {
  href: ComponentProps<typeof Link>["href"];
  eventName: AppActionEventName;
  payload?: Record<string, unknown>;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
} & LinkProps) {
  const posthog = usePostHog();

  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        captureAppEvent(posthog, eventName, payload);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
