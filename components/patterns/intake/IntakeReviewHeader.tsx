import { Trash2 } from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { IntakeFieldGuideDialog } from "@/components/intake-field-guide-dialog";
import { humanizeToken } from "@/lib/utils";

export function IntakeReviewHeader({
  sessionId,
  status,
}: {
  sessionId: string;
  status: string;
}) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl space-y-3">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Confirm workspace
          </h1>
          <IntakeFieldGuideDialog />
        </div>
        <p className="text-[15px] leading-7 text-black/60 dark:text-white/65 sm:text-[17px] sm:leading-8">
          Review the extracted details, fix anything that looks off, then create the workspace.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="bg-black/5 px-4 py-2 text-sm font-semibold text-black/65 dark:bg-white/10 dark:text-white/70">
          {humanizeToken(status)}
        </div>
        <form action={deleteIntakeDraftAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="redirectTo" value="/app" />
          <DeleteDraftButton className="inline-flex items-center gap-2 border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60">
            <Trash2 className="h-4 w-4" />
            Delete draft
          </DeleteDraftButton>
        </form>
      </div>
    </section>
  );
}
