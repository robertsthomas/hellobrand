"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";

import { deleteWorkspaceAction } from "@/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/50 transition hover:border-black/15 hover:text-black/70 dark:border-white/10 dark:text-white/50 dark:hover:border-white/15 dark:hover:text-white/75"
          aria-label={`Open actions for ${dealName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <form action={deleteWorkspaceAction}>
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="redirectTo" value="/app" />
          <DropdownMenuItem asChild variant="destructive">
            <button
              type="submit"
              className="flex w-full items-center gap-2"
              onClick={(event) => {
                const confirmed = window.confirm(
                  "Delete this deal and all of its uploaded documents? This cannot be undone."
                );

                if (!confirmed) {
                  event.preventDefault();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete deal
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
