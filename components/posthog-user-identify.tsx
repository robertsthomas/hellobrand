"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

import { isPostHogConfigured } from "@/lib/posthog/config";

export function PostHogUserIdentify({
  userId,
  email,
  displayName
}: {
  userId: string;
  email: string;
  displayName: string;
}) {
  const posthog = usePostHog();

  useEffect(() => {
    if (!isPostHogConfigured() || !posthog) {
      return;
    }

    posthog.identify(
      userId,
      {
        email,
        displayName
      },
      {
        email,
        displayName
      }
    );
  }, [displayName, email, posthog, userId]);

  return null;
}
