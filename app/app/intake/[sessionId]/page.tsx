import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Trash2 } from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import {
  DeleteDraftButton,
  IntakeAutoRefresh,
  IntakeDuplicateWarning,
  IntakePendingUpload,
  IntakeProcessingState,
  StartQueuedAnalysisButton,
} from "@/components/intake-flow";
import { PostHogActionLink } from "@/components/posthog-action-link";
import { requireViewer } from "@/lib/auth";

import {
  loadIntakeSessionRouteData,
  shouldRedirectToDeal
} from "./page-helpers";

export default function IntakeProcessingPage({
  params,
  searchParams
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ starting?: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-primary" /></div>}>
      <IntakeProcessingContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function IntakeProcessingContent({
  params,
  searchParams
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ starting?: string }>;
}) {
  const viewer = await requireViewer();
  const { sessionId } = await params;
  const resolvedSearchParams = await searchParams;
  const isStarting = resolvedSearchParams.starting === "1";
  const sessionData = await loadIntakeSessionRouteData(viewer, sessionId);

  if (!sessionData) {
    redirect("/app");
  }

  const { session, aggregate, processing } = sessionData;
  const dealRedirect = shouldRedirectToDeal(session, aggregate);
  if (dealRedirect) {
    redirect(dealRedirect);
  }

  if (["ready_for_confirmation", "failed"].includes(session.status)) {
    redirect(`/app/intake/${session.id}/review`);
  }

  const documents = aggregate?.documents ?? [];

  if (session.status === "queued" && !isStarting) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
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
              <PostHogActionLink
                href="/app/intake/new"
                eventName="workspace_entry_cta_clicked"
                payload={{ source: "queued_intake_state" }}
                className="text-sm font-medium text-black/60 transition hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                Create another workspace
              </PostHogActionLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-md">
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
        {session.errorMessage ? (
          <p className="mt-4 text-center text-sm text-destructive">{session.errorMessage}</p>
        ) : null}

        <div className="mt-6 text-center">
          <form action={deleteIntakeDraftAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="redirectTo" value="/app" />
            <DeleteDraftButton
              className="text-sm text-muted-foreground transition hover:text-destructive bg-primary/5 hover:bg-primary/10 rounded-full px-4 py-2"
            >
              Cancel Intake
            </DeleteDraftButton>
          </form>
        </div>
      </div>

      <div className="sr-only">
        <IntakePendingUpload sessionId={session.id} status={session.status} />
        <IntakeAutoRefresh
          sessionId={session.id}
          status={session.status}
          readyHref={`/app/intake/${session.id}/review`}
          forcePolling={isStarting}
        />
      </div>
    </div>
  );
}
