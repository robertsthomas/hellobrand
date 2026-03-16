"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";

import { DeleteDealDialog } from "@/components/delete-deal-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function RecentDealCardMenu({
  dealId,
  dealName
}: {
  dealId: string;
  dealName: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center p-0 text-black/45 transition hover:text-black/70 dark:text-white/45 dark:hover:text-white/75"
          aria-label={`Open actions for ${dealName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44 border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-neutral-950"
      >
        <DeleteDealDialog
          dealId={dealId}
          dealName={dealName}
          redirectTo="/app"
          triggerMode="menu-item"
          menuLabel="Delete"
        >
          <>
            <Trash2 className="h-4 w-4" />
            Delete
          </>
        </DeleteDealDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
