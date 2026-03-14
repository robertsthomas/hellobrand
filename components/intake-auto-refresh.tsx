"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

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
    <p className="inline-flex items-center gap-2 text-xs text-black/45 dark:text-white/45">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      Auto-refreshing while analysis runs.
    </p>
  );
}
