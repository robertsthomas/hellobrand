"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  showSpinner = false,
  type = "submit",
  ...props
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
  showSpinner?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      aria-busy={pending || undefined}
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      disabled={disabled || pending}
      type={type}
    >
      {pending ? (
        showSpinner ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            {pendingLabel}
          </span>
        ) : (
          pendingLabel
        )
      ) : (
        children
      )}
    </button>
  );
}
