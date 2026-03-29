"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function DeleteDealDialog({
  dealId,
  redirectTo,
  dealName,
  className,
  children,
  menuLabel = "Delete",
  triggerLabel = "Delete partnership",
  triggerMode = "button",
}: {
  dealId: string;
  redirectTo: string;
  dealName: string;
  className?: string;
  children?: ReactNode;
  menuLabel?: string;
  triggerLabel?: string;
  triggerMode?: "button" | "menu-item";
}) {
  const params = new URLSearchParams({ redirectTo });
  const href = `/app/p/${dealId}/delete?${params.toString()}`;

  const trigger =
    triggerMode === "menu-item" ? (
      <DropdownMenuItem asChild variant="destructive">
        <Link href={href}>
          <span className="flex w-full items-center gap-2">{children ?? menuLabel}</span>
        </Link>
      </DropdownMenuItem>
    ) : (
      <Link
        href={href}
        className={className}
        aria-label={triggerLabel}
      >
        {children ?? triggerLabel}
      </Link>
    );

  return trigger;
}
