"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  type = "submit",
  ...props
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      className={className}
      disabled={disabled || pending}
      type={type}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
