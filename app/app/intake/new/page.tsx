import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { IntakeDraftEditor } from "@/components/intake-draft-editor";
import { requireViewer } from "@/lib/auth";
import { getIntakeSessionForViewer } from "@/lib/intake";

export default async function NewIntakePage({
  searchParams
}: {
  searchParams: Promise<{ pick?: string; mode?: string; draft?: string }>;
}) {
  const viewer = await requireViewer();
  const resolvedSearchParams = await searchParams;
  const autoOpenPicker = resolvedSearchParams.pick === "1";
  const initialMode =
    resolvedSearchParams.mode === "paste" && !autoOpenPicker ? "paste" : "upload";
  let initialDraft: Parameters<typeof IntakeDraftEditor>[0]["initialDraft"] = null;

  if (resolvedSearchParams.draft) {
    const payload = await getIntakeSessionForViewer(viewer, resolvedSearchParams.draft);

    if (payload.session.status !== "draft") {
      redirect(`/app/intake/${payload.session.id}`);
    }

    initialDraft = {
      sessionId: payload.session.id,
      mode:
        payload.session.inputSource === "paste" && !autoOpenPicker
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
            <h1 className="text-4xl font-semibold text-ink">Upload documents</h1>
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
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60"
              >
                <Trash2 className="h-4 w-4" />
                Delete draft
              </button>
            </form>
          ) : null}
        </section>
        <IntakeDraftEditor
          autoOpenPicker={autoOpenPicker}
          initialMode={initialMode}
          initialDraft={initialDraft}
        />
      </div>
    </div>
  );
}
