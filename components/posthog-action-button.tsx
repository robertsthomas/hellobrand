"use client";

import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { usePostHog } from "posthog-js/react";

import { captureAppEvent, type AppActionEventName } from "@/lib/posthog/events";

export function PostHogActionButton({
  eventName,
  payload,
  onClick,
  children,
  ...props
}: {
  eventName: AppActionEventName;
  payload?: Record<string, unknown>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const posthog = usePostHog();

  return (
    <button
      {...props}
      onClick={(event) => {
        captureAppEvent(posthog, eventName, payload);
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
