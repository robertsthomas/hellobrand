import { Suspense } from "react";

import { InboxWorkspace } from "@/components/inbox-workspace";
import { requireViewer } from "@/lib/auth";
import { listDealsForViewer } from "@/lib/deals";
import { getEmailThreadForViewer, listInboxThreadsForViewer } from "@/lib/email/service";

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
  const [threads, deals] = await Promise.all([
    listInboxThreadsForViewer(viewer, {
      query: resolved.q ?? null,
      provider: resolved.provider ?? null,
      accountId: resolved.accountId ?? null,
      linkedDealId: resolved.dealId ?? null,
      limit: 100
    }),
    listDealsForViewer(viewer)
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
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1320px] animate-pulse space-y-6">
        <div className="h-24 border border-black/8 bg-black/[0.04]" />
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="h-[640px] border border-black/8 bg-black/[0.04]" />
          <div className="h-[640px] border border-black/8 bg-black/[0.04]" />
        </div>
      </div>
    </div>
  );
}
