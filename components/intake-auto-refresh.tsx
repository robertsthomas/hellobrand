"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { IntakeSessionStatus } from "@/lib/types";

export function IntakeAutoRefresh({
  status
}: {
  status: IntakeSessionStatus;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!["uploading", "processing"].includes(status)) {
      return;
    }

    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [router, startTransition, status]);

  if (!["uploading", "processing"].includes(status)) {
    return null;
  }

  return (
    <p className="text-xs text-black/45 dark:text-white/45">
      Auto-refreshing while analysis runs.
    </p>
  );
}
