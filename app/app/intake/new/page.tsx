import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Trash2 } from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { CardSkeleton } from "@/components/skeletons";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { EmptyDashboardUpload } from "@/components/empty-dashboard-upload";
import { IntakeDraftEditor } from "@/components/intake-draft-editor";
import { requireViewer } from "@/lib/auth";
import { getIntakeSessionForViewer, listIntakeDraftsForViewer } from "@/lib/intake";

export default function NewIntakePage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string; draft?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl"><CardSkeleton /></div></div>}>
      <NewIntakeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewIntakeContent({
  searchParams
}: {
  searchParams: Promise<{ mode?: string; draft?: string }>;
}) {
  const viewer = await requireViewer();
  const intakeDrafts = await listIntakeDraftsForViewer(viewer);
  const resolvedSearchParams = await searchParams;
  const initialMode = resolvedSearchParams.mode === "paste" ? "paste" : "upload";
  let initialDraft: Parameters<typeof IntakeDraftEditor>[0]["initialDraft"] = null;

  if (resolvedSearchParams.draft) {
    const payload = await getIntakeSessionForViewer(viewer, resolvedSearchParams.draft);

    if (payload.session.status !== "draft") {
      redirect(`/app/intake/${payload.session.id}`);
    }

    initialDraft = {
      sessionId: payload.session.id,
      mode:
        payload.session.inputSource === "paste"
          ? "paste"
          : initialMode,
      brandName:
        payload.session.draftBrandName ??
        payload.aggregate?.deal.brandName ??
        "",
      campaignName:
        payload.session.draftCampaignName ??
        payload.aggregate?.deal.campaignName ??
        "",
      notes: payload.session.draftNotes ?? "",
      pastedText: payload.session.draftPastedText ?? ""
    };
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-8">
        <section className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="max-w-3xl space-y-1.5 sm:space-y-3">
            <h1 className="text-[2.45rem] font-semibold leading-none tracking-[-0.05em] text-ink sm:text-4xl">
              New workspace
            </h1>
            <p className="hidden text-[15px] leading-7 text-black/60 dark:text-white/65 sm:block">
              Add your sources, save each workspace, then start analysis.
            </p>
          </div>
          {initialDraft?.sessionId ? (
            <form action={deleteIntakeDraftAction}>
              <input type="hidden" name="sessionId" value={initialDraft.sessionId} />
              <input type="hidden" name="redirectTo" value="/app" />
              <DeleteDraftButton
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60"
              >
                <Trash2 className="h-4 w-4" />
                Delete draft
              </DeleteDraftButton>
            </form>
          ) : null}
        </section>
        {initialDraft ? (
          <IntakeDraftEditor
            autoOpenPicker={false}
            initialMode={initialMode}
            initialDraft={initialDraft}
          />
        ) : (
          <div className="max-w-3xl">
            <EmptyDashboardUpload
              initialMode={initialMode}
              initialQueuedWorkspaces={intakeDrafts.filter(
                ({ session }) => session.status === "queued"
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
