"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { CreatorProfileSetupDialog } from "@/components/creator-profile-setup-dialog";

const DISMISS_KEY = "hellobrand:profile-onboarding-banner:dismissed";

const HIDDEN_ROUTES = ["/app/intake", "/app/onboarding", "/app/settings/profile", "/app/inbox"];

export function ProfileOnboardingBanner({
  email,
  initialName,
  initialHandle
}: {
  email: string;
  initialName: string;
  initialHandle: string;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const wasDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    setVisible(!wasDismissed);
  }, []);

  if (HIDDEN_ROUTES.some((route) => pathname.startsWith(route))) {
    return null;
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="border-b border-black/8 bg-[#f7f4ed] px-4 py-3 dark:border-white/10 dark:bg-[#16181d] sm:px-5 sm:py-4">
      <div className="mx-auto max-w-[1520px] space-y-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <p className="text-sm font-semibold text-foreground">
          Finish your creator profile when you&apos;re ready.
        </p>

        <div className="flex items-center gap-2">
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
              setVisible(false);
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-black/8 bg-white text-muted-foreground transition hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]"
            aria-label="Dismiss profile reminder"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
