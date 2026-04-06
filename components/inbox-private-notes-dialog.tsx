"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { EmailThreadDetail } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function InboxPrivateNotesDialog({
  open,
  onOpenChange,
  selectedThread,
  noteBody,
  setNoteBody,
  isSavingNote,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedThread: EmailThreadDetail | null;
  noteBody: string;
  setNoteBody: (value: string) => void;
  isSavingNote: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Private notes</DialogTitle>
          <DialogDescription>
            Capture guidance, risks, and follow-up notes for this thread.
          </DialogDescription>
        </DialogHeader>

        {selectedThread ? (
          <div className="space-y-4">
            {selectedThread.notes.length > 0 ? (
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {selectedThread.notes.map((note) => (
                  <div key={note.id} className="border-l-2 border-black/8 pl-3">
                    <p className="text-[12px] text-foreground">{note.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(note.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                No private notes yet.
              </p>
            )}

            <div className="space-y-2 border-t border-black/6 pt-4">
              <Textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.currentTarget.value)}
                placeholder="Capture guidance, risks, or follow-up notes for yourself..."
                className="min-h-[120px] rounded-none border-black/10 bg-white text-[12px] shadow-none"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-9 w-full items-center justify-center border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03] sm:w-auto"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!noteBody.trim() || isSavingNote}
                  className="inline-flex h-9 w-full items-center justify-center border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03] disabled:opacity-40 sm:w-auto"
                >
                  {isSavingNote ? "Saving..." : "Save note"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
