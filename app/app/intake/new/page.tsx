import { redirect } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { EmptyDashboardUpload } from "@/components/empty-dashboard-upload";
import { IntakeDraftEditor } from "@/components/intake-draft-editor";
import { requireViewer } from "@/lib/auth";
import { getIntakeSessionForViewer } from "@/lib/intake";

export default async function NewIntakePage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string; draft?: string }>;
}) {
  const viewer = await requireViewer();
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
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
              Documents
            </p>
            <h1 className="text-4xl font-semibold text-ink">New workspace</h1>
            <p className="text-[17px] leading-8 text-black/60 dark:text-white/65">
              Upload a contract, paste an email thread, or do both. HelloBrand
              analyzes the source material first, then lets you confirm the deal
              details before the workspace goes live.
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
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="mb-3 text-2xl font-semibold">Start a new workspace</h2>
              <p className="mb-8 text-black/60 dark:text-white/65">
                Upload your first deal document or paste text to create a new workspace.
              </p>
              <EmptyDashboardUpload initialMode={initialMode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
