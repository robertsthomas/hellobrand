"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeInboxSort, type InboxSortOption } from "@/lib/email/inbox-sort";

import { InboxSelect } from "@/components/inbox-select";

export function InboxSortDialog({
  open,
  onOpenChange,
  draftSort,
  setDraftSort,
  onApply
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftSort: InboxSortOption;
  setDraftSort: (value: InboxSortOption) => void;
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sort inbox</DialogTitle>
          <DialogDescription>
            Choose how linked inbox threads should be ordered in the list.
          </DialogDescription>
        </DialogHeader>

        <InboxSelect
          value={draftSort}
          onChange={(value) => setDraftSort(normalizeInboxSort(value))}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="subject">Subject A-Z</option>
        </InboxSelect>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:w-auto"
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
