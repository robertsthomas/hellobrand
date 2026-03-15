"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function DeleteDraftButton({
  label = "Delete draft",
  className,
  children,
  ...props
}: {
  label?: string;
  className?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      className={className}
      {...props}
      onClick={(event) => {
        const confirmed = window.confirm(
          "Delete this intake draft? This will remove the draft and its in-progress uploaded source material."
        );

        if (!confirmed) {
          event.preventDefault();
        }

        props.onClick?.(event);
      }}
    >
      {children ?? label}
    </button>
  );
}
