"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { usePostHog } from "posthog-js/react";

import { SubmitButton } from "@/components/submit-button";
import { captureAppEvent, type AppActionEventName } from "@/lib/posthog/events";

export function PostHogSubmitButton({
  eventName,
  payload,
  children,
  ...props
}: {
  eventName: AppActionEventName;
  payload?: Record<string, unknown>;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<Parameters<typeof SubmitButton>[0], "children">) {
  const posthog = usePostHog();

  return (
    <SubmitButton
      {...props}
      onClick={(event) => {
        captureAppEvent(posthog, eventName, payload);
        props.onClick?.(event);
      }}
    >
      {children}
    </SubmitButton>
  );
}
