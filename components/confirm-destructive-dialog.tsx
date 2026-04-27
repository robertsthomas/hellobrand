"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

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

type ConfirmDestructiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  confirmLoading?: boolean;
  alternative?: {
    label: string;
    onClick: () => void;
  };
};

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  confirmLoading,
  alternative,
}: ConfirmDestructiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-clay" />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirmLoading}>Cancel</AlertDialogCancel>
          {alternative && (
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-ocean/40 bg-white px-4 text-sm font-medium text-ocean transition-colors hover:bg-ocean/5 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => {
                alternative.onClick();
                onOpenChange(false);
              }}
              disabled={confirmLoading}
            >
              {alternative.label}
            </button>
          )}
          <AlertDialogAction
            className="border border-clay/40 bg-clay text-white hover:bg-clay/90"
            onClick={onConfirm}
            disabled={confirmLoading}
          >
            {confirmLoading ? "Processing..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
