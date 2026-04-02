"use client";

import { StickyNote } from "lucide-react";

import { saveDealNotesAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { sanitizePlainTextInput } from "@/lib/utils";

export function DealNotesDrawer({
  dealId,
  notes
}: {
  dealId: string;
  notes: string | null;
}) {
  const sanitizedNotes = sanitizePlainTextInput(notes);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 border border-black/10 px-3 text-sm font-medium text-foreground transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
          aria-label="Open notes"
        >
          <StickyNote className="h-4 w-4" />
          <span className="hidden sm:inline">Notes</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-black/8 px-6 py-5 dark:border-white/10">
          <SheetTitle>Notes</SheetTitle>
          <SheetDescription>
            Creator-side context, negotiation reminders, or delivery prep notes.
          </SheetDescription>
        </SheetHeader>
        <form action={saveDealNotesAction} className="flex h-full flex-col">
          <input type="hidden" name="dealId" value={dealId} />
          <div className="flex-1 px-6 py-5">
            <textarea
              className="min-h-[280px] w-full border border-black/10 bg-white px-4 py-4 text-sm text-foreground outline-none transition focus:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:focus:border-white/20"
              name="notes"
              defaultValue={sanitizedNotes}
              placeholder="Add notes, open questions, negotiated updates, or payment reminders."
            />
          </div>
          <div className="border-t border-black/8 px-6 py-4 dark:border-white/10">
            <SubmitButton
              pendingLabel="Saving..."
              showSpinner
              className="inline-flex border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/12 dark:bg-white/[0.03]"
            >
              Save notes
            </SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
