"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { deleteWorkspaceAction } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const trigger =
    triggerMode === "menu-item" ? (
      <DropdownMenuItem
        variant="destructive"
        onSelect={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span className="flex w-full items-center gap-2">{children ?? menuLabel}</span>
      </DropdownMenuItem>
    ) : (
      <button
        type="button"
        className={className}
        aria-label={triggerLabel}
        onClick={() => setOpen(true)}
      >
        {children ?? triggerLabel}
      </button>
    );

  return (
    <>
      <form ref={formRef} action={deleteWorkspaceAction}>
        <input type="hidden" name="dealId" value={dealId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
      </form>

      {trigger}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-md rounded-md border-black/10 bg-background p-6 dark:border-white/10">
          <AlertDialogHeader className="gap-3">
            <AlertDialogTitle>Delete this partnership?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              This deletes <span className="font-medium text-foreground">{dealName}</span>,
              all uploaded documents, extracted data, summaries, and related workspace
              history. This action cannot be undone or recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                formRef.current?.requestSubmit();
                setOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
