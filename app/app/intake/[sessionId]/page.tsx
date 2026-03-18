import Link from "next/link";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { IntakeAutoRefresh } from "@/components/intake-auto-refresh";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { IntakeDuplicateWarning } from "@/components/intake-duplicate-warning";
import { IntakePendingUpload } from "@/components/intake-pending-upload";
import { IntakeProcessingState } from "@/components/intake-processing-state";
import { StartQueuedAnalysisButton } from "@/components/start-queued-analysis-button";
import { requireViewer } from "@/lib/auth";
import { getIntakeSessionForViewer } from "@/lib/intake";

export const dynamic = "force-dynamic";

export default async function IntakeProcessingPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const viewer = await requireViewer();
  const { sessionId } = await params;
  let sessionData: Awaited<ReturnType<typeof getIntakeSessionForViewer>>;

  try {
    sessionData = await getIntakeSessionForViewer(viewer, sessionId);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Intake session not found."
    ) {
      redirect("/app");
    }

    throw error;
  }

  const { session, aggregate, processing } = sessionData;

  if (session.status === "completed" && aggregate) {
    redirect(`/app/deals/${aggregate.deal.id}`);
  }

  if (["ready_for_confirmation", "failed"].includes(session.status)) {
    redirect(`/app/intake/${session.id}/review`);
  }

  const documents = aggregate?.documents ?? [];

  if (session.status === "queued") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-8 border border-black/8 bg-white p-8 dark:border-white/10 dark:bg-[#161a1f]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                Ready to analyze
              </p>
              <h1 className="text-3xl font-semibold text-ink">
                This workspace is queued
              </h1>
              <p className="max-w-xl text-sm leading-7 text-black/60 dark:text-white/65">
                Your sources are attached and saved. Start analysis now, or queue
                more workspaces first and let HelloBrand run them one at a time.
              </p>
            </div>
            <form action={deleteIntakeDraftAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="redirectTo" value="/app" />
              <DeleteDraftButton
                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60"
              >
                <Trash2 className="h-4 w-4" />
                Delete draft
              </DeleteDraftButton>
            </form>
          </div>

          <div className="grid gap-4 border-t border-black/8 pt-6 dark:border-white/10">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{documents.length} source{documents.length === 1 ? "" : "s"} attached</span>
              <span>Status: queued</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StartQueuedAnalysisButton sessionIds={[session.id]} />
              <Link
                href="/app/intake/new"
                className="text-sm font-medium text-black/60 transition hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                Create another workspace
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8">
      <div className="relative w-full max-w-3xl">
        <div className="absolute right-0 top-0">
          <form action={deleteIntakeDraftAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="redirectTo" value="/app" />
            <DeleteDraftButton
              className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/60 transition hover:border-clay/20 hover:text-clay dark:border-white/10 dark:text-white/60"
            >
              <Trash2 className="h-4 w-4" />
              Cancel intake
            </DeleteDraftButton>
          </form>
        </div>

        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <IntakeProcessingState
            documentsCount={documents.length}
            sessionId={session.id}
            status={session.status}
            initialProcessing={processing}
          />
          <IntakeDuplicateWarning
            sessionId={session.id}
            dealId={session.dealId}
            status={session.status}
          />
          <div className="sr-only">
            <IntakePendingUpload sessionId={session.id} status={session.status} />
            <IntakeAutoRefresh
              sessionId={session.id}
              status={session.status}
              readyHref={`/app/intake/${session.id}/review`}
            />
          </div>
          {session.errorMessage ? (
            <p className="mt-4 text-center text-sm text-clay">{session.errorMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
