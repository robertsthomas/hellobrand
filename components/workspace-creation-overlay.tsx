"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function WorkspaceCreationOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5 text-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-ocean" />
        <div className="space-y-2">
          <p className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            Generating workspace
          </p>
          <p className="text-sm text-black/55 dark:text-white/60">
            Organizing your documents, extracted terms, and creator workflow details.
          </p>
        </div>
      </div>
    </div>
  );
}
