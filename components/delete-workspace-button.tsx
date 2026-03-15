"use client";

import type { ReactNode } from "react";

export function DeleteWorkspaceButton({
  label = "Delete deal",
  className,
  children
}: {
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        const confirmed = window.confirm(
          "Delete this deal and all of its uploaded documents? This cannot be undone."
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      {children ?? label}
    </button>
  );
}
