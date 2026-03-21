import { Suspense } from "react";

import { InboxWorkspace } from "@/components/inbox-workspace";
import { requireViewer } from "@/lib/auth";
import { listDealsForViewer } from "@/lib/deals";
import {
  getEmailThreadForViewer,
  listEmailAccountsForViewer,
  listInboxThreadsForViewer
} from "@/lib/email/service";

export default function InboxPage({
  searchParams
}: {
  searchParams?: Promise<{
    q?: string;
    provider?: string;
    accountId?: string;
    dealId?: string;
    thread?: string;
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
    thread?: string;
  }>;
}) {
  const viewer = await requireViewer();
  const resolved = searchParams ? await searchParams : {};
  const [threads, deals, emailAccounts] = await Promise.all([
    listInboxThreadsForViewer(viewer, {
      query: resolved.q ?? null,
      provider: resolved.provider ?? null,
      accountId: resolved.accountId ?? null,
      linkedDealId: resolved.dealId ?? null,
      linkedOnly: true,
      limit: 100
    }),
    listDealsForViewer(viewer),
    listEmailAccountsForViewer(viewer)
  ]);

  const selectedThreadId = resolved.thread ?? threads[0]?.thread.id ?? null;
  const selectedThread = selectedThreadId
    ? await getEmailThreadForViewer(viewer, selectedThreadId)
    : null;

  return (
    <InboxWorkspace
      threads={threads}
      selectedThread={selectedThread}
      deals={deals}
      hasConnectedAccounts={emailAccounts.length > 0}
      selectedFilters={{
        q: resolved.q ?? "",
        provider: resolved.provider ?? "",
        accountId: resolved.accountId ?? "",
        dealId: resolved.dealId ?? ""
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
