"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

import { getPostHogClientHost, getPostHogClientKey } from "@/lib/posthog/config";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const posthogKey = getPostHogClientKey();
    if (!posthogKey || posthog.__loaded) {
      return;
    }

    posthog.init(posthogKey, {
      api_host: getPostHogClientHost(),
      defaults: "2026-01-30",
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      loaded: (instance) => {
        if (process.env.NODE_ENV === "development") {
          instance.debug();
        }
      }
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
