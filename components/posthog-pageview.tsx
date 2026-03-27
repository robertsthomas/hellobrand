"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";

import { isPostHogConfigured } from "@/lib/posthog/config";

export function PostHogPageView() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string | null>(null);
  const search = searchParams.toString();

  useEffect(() => {
    if (!isPostHogConfigured() || !posthog) {
      return;
    }

    const currentUrl = window.location.href;
    if (lastTrackedUrlRef.current === currentUrl) {
      return;
    }

    lastTrackedUrlRef.current = currentUrl;
    posthog.capture("$pageview", {
      $current_url: currentUrl
    });
  }, [pathname, posthog, search]);

  return null;
}
