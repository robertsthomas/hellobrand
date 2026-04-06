import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function IntakeField({
  label,
  children,
  footer,
  className
}: {
  label: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "grid gap-2 text-sm font-medium text-black/70 dark:text-white/75",
        className
      )}
    >
      <span>{label}</span>
      {children}
      {footer ?? null}
    </label>
  );
}
