"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type AppFrameSignOutButtonProps = {
  children: ReactNode;
  className?: string;
  onBeforeSignOut?: () => void;
};

const e2eAuthEnabled = process.env.NEXT_PUBLIC_HELLOBRAND_E2E_AUTH === "1";

export function AppFrameSignOutButton({
  children,
  className,
  onBeforeSignOut,
}: AppFrameSignOutButtonProps) {
  if (e2eAuthEnabled) {
    return (
      <E2ESignOutButton className={className} onBeforeSignOut={onBeforeSignOut}>
        {children}
      </E2ESignOutButton>
    );
  }

  return (
    <ClerkSignOutButton className={className} onBeforeSignOut={onBeforeSignOut}>
      {children}
    </ClerkSignOutButton>
  );
}

function E2ESignOutButton({ children, className, onBeforeSignOut }: AppFrameSignOutButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        onBeforeSignOut?.();
        await fetch("/api/test-auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

function ClerkSignOutButton({ children, className, onBeforeSignOut }: AppFrameSignOutButtonProps) {
  const { signOut } = useClerk();

  return (
    <button
      type="button"
      onClick={() => {
        onBeforeSignOut?.();
        signOut({ redirectUrl: "/login" });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
