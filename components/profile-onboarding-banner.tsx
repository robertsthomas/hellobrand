"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { CreatorProfileSetupDialog } from "@/components/creator-profile-setup-dialog";

const DISMISS_KEY = "hellobrand:profile-onboarding-banner:dismissed";

export function ProfileOnboardingBanner({
  email,
  initialName,
  initialHandle
}: {
  email: string;
  initialName: string;
  initialHandle: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <div className="border-b border-black/8 bg-[#f7f4ed] px-5 py-4 dark:border-white/10 dark:bg-[#16181d]">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Finish your creator profile when you&apos;re ready.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your name and handle so future uploads and workspaces start with your
            default creator info.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CreatorProfileSetupDialog
            email={email}
            initialName={initialName}
            initialHandle={initialHandle}
            configured={false}
          />
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="inline-flex h-10 w-10 items-center justify-center border border-black/8 bg-white text-muted-foreground transition hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]"
            aria-label="Dismiss profile reminder"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
