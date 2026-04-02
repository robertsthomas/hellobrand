import { Suspense } from "react";

import { InboxPreviewLocked } from "@/components/inbox-preview-locked";
import { InboxWorkspace } from "@/components/inbox-workspace";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { getCachedDealForViewer } from "@/lib/cached-data";
import { listDealsForViewer } from "@/lib/deals";
import {
  getEmailThreadForViewer,
  listEmailAccountsForViewer,
  listInboxThreadsForViewer
} from "@/lib/email/service";
import { listEmailThreadPreviewStatesForViewer } from "@/lib/email/preview-state";
import { getProfileForViewer } from "@/lib/profile";

export default function InboxPage({
  searchParams
}: {
  searchParams?: Promise<{
    q?: string;
    provider?: string;
    accountId?: string;
    dealId?: string;
    workflowState?: string;
    thread?: string;
    attachInvoice?: string;
  }>;
}) {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InboxContent({
  searchParams
}: {
  searchParams?: Promise<{
    q?: string;
    provider?: string;
    accountId?: string;
    dealId?: string;
    workflowState?: string;
    thread?: string;
    attachInvoice?: string;
  }>;
}) {
  const viewer = await requireViewer();
  const entitlements = await getViewerEntitlements(viewer);
  if (!entitlements.features.premium_inbox) {
    return (
      <InboxPreviewLocked
        currentTier={entitlements.effectiveTier}
        hasActiveSubscription={entitlements.hasActiveSubscription}
      />
    );
  }

  const resolved = searchParams ? await searchParams : {};
  const [threads, deals, emailAccounts, profile] = await Promise.all([
    listInboxThreadsForViewer(viewer, {
      query: resolved.q ?? null,
      provider: resolved.provider ?? null,
      accountId: resolved.accountId ?? null,
      linkedDealId: resolved.dealId ?? null,
      workflowState: (resolved.workflowState as
        | "unlinked"
        | "needs_review"
        | "needs_reply"
        | "draft_ready"
        | "waiting_on_them"
        | "closed"
        | undefined) ?? null,
      limit: 100
    }),
    listDealsForViewer(viewer),
    listEmailAccountsForViewer(viewer),
    getProfileForViewer(viewer)
  ]);
  const connectedProviders = [...new Set(emailAccounts.map((account) => account.provider))];
  const selectedProvider =
    resolved.provider && connectedProviders.includes(resolved.provider as (typeof connectedProviders)[number])
      ? resolved.provider
      : "";

  const selectedThreadId = resolved.thread ?? threads[0]?.thread.id ?? null;
  const [selectedThread, threadPreviewStates] = await Promise.all([
    selectedThreadId
      ? getEmailThreadForViewer(viewer, selectedThreadId)
      : Promise.resolve(null),
    listEmailThreadPreviewStatesForViewer(
      viewer,
      threads.map((item) => item.thread.id)
    )
  ]);
  const linkedDealIds = Array.from(
    new Set(threads.flatMap((item) => item.links.map((link) => link.dealId)))
  );
  const linkedDealAggregates = await Promise.all(
    linkedDealIds.map(async (dealId) => ({
      dealId,
      aggregate: await getCachedDealForViewer(viewer, dealId)
    }))
  );
  const invoiceAttachmentsByDealId = Object.fromEntries(
    linkedDealAggregates.flatMap(({ dealId, aggregate }) => {
      const invoice = aggregate?.invoiceRecord;
      const invoiceDocument = aggregate?.documents.find(
        (document) => document.id === invoice?.pdfDocumentId
      );

      if (!invoice || !invoice.pdfDocumentId || !invoiceDocument) {
        return [];
      }

      return [[
        dealId,
        {
          dealId,
          documentId: invoiceDocument.id,
          fileName: invoiceDocument.fileName,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status
        }
      ]];
    })
  );

  return (
    <InboxWorkspace
      threads={threads}
      selectedThread={selectedThread}
      threadPreviewStates={threadPreviewStates}
      deals={deals}
      hasConnectedAccounts={emailAccounts.length > 0}
      connectedProviders={connectedProviders}
      profile={profile}
      invoiceAttachmentsByDealId={invoiceAttachmentsByDealId}
      autoAttachInvoice={resolved.attachInvoice === "1"}
      selectedFilters={{
        q: resolved.q ?? "",
        provider: selectedProvider,
        accountId: resolved.accountId ?? "",
        dealId: resolved.dealId ?? "",
        workflowState: resolved.workflowState ?? ""
      }}
    />
  );
}

function InboxSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col px-5 py-4 lg:px-8 lg:py-5">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] animate-pulse flex-col gap-4">
        <div className="h-20 border border-black/8 bg-black/[0.04]" />
        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="min-h-[620px] border border-black/8 bg-black/[0.04]" />
          <div className="min-h-[620px] border border-black/8 bg-black/[0.04]" />
        </div>
      </div>
    </div>
  );
}
