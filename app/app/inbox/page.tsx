import { Suspense } from "react";
import Link from "next/link";

import { PlanTier } from "@prisma/client";
import {
  ArrowRight,
  Inbox as InboxIcon,
  Mail,
  Paperclip,
  Star,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";

import { FeatureUpgradeCard } from "@/components/feature-locked-state";
import { InboxWorkspace } from "@/components/inbox-workspace";
import { requireViewer } from "@/lib/auth";
import { getViewerEntitlements } from "@/lib/billing/entitlements";
import { listDealsForViewer } from "@/lib/deals";
import {
  getEmailThreadForViewer,
  listEmailAccountsForViewer,
  listInboxThreadsForViewer
} from "@/lib/email/service";

const DUMMY_THREADS = [
  {
    id: "1",
    from: "Sarah Chen",
    brand: "Glossier",
    subject: "Partnership deliverables — March campaign",
    preview: "Hi! Just wanted to follow up on the content calendar we discussed. The team loved your initial concepts and we'd like to...",
    time: "2h ago",
    unread: true,
    hasAttachment: true,
    starred: true,
  },
  {
    id: "2",
    from: "Marcus Rivera",
    brand: "Nike",
    subject: "Re: Contract revision — Spring collection",
    preview: "Thanks for sending over the updated terms. I've reviewed the exclusivity clause and have a few questions about the...",
    time: "4h ago",
    unread: true,
    hasAttachment: false,
    starred: false,
  },
  {
    id: "3",
    from: "Emma Walsh",
    brand: "Spotify",
    subject: "Payment confirmation — January invoice",
    preview: "This is to confirm that payment of $4,500 has been processed for the January campaign deliverables. You should see...",
    time: "Yesterday",
    unread: false,
    hasAttachment: true,
    starred: false,
  },
  {
    id: "4",
    from: "Jordan Lee",
    brand: "Adobe",
    subject: "Brief: Creative suite ambassador program",
    preview: "We're excited to share the campaign brief for our upcoming ambassador program. We'd love to have you create a series of...",
    time: "Yesterday",
    unread: false,
    hasAttachment: true,
    starred: true,
  },
  {
    id: "5",
    from: "Priya Patel",
    brand: "Fenty Beauty",
    subject: "Content approval — Product launch",
    preview: "The team has reviewed your submitted content and we're happy to confirm approval for all three deliverables. Great work on the...",
    time: "2d ago",
    unread: false,
    hasAttachment: false,
    starred: false,
  },
  {
    id: "6",
    from: "Alex Thompson",
    brand: "Samsung",
    subject: "Re: Negotiation update — Tech review series",
    preview: "I spoke with the partnerships team and they're open to adjusting the usage rights window from 12 months to 6 months as you...",
    time: "3d ago",
    unread: false,
    hasAttachment: false,
    starred: false,
  },
];

const DUMMY_ACTIONS = [
  { label: "Review contract terms", brand: "Nike", icon: AlertCircle, tone: "text-amber-600" },
  { label: "Submit March deliverables", brand: "Glossier", icon: Clock, tone: "text-foreground" },
  { label: "Follow up on payment", brand: "Adobe", icon: Mail, tone: "text-red-500" },
];

function InboxPreviewLocked({
  currentTier,
  hasActiveSubscription,
}: {
  currentTier: PlanTier;
  hasActiveSubscription: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col px-5 py-4 lg:px-8 lg:py-5">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] flex-col gap-4">
        {/* Header bar */}
        <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <InboxIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Inbox</h1>
            <span className="rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Preview
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Sample data shown below
          </div>
        </div>

        {/* Main content */}
        <div className="relative grid min-h-0 flex-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          {/* Thread list */}
          <div className="flex min-h-[600px] flex-col rounded-xl border border-black/[0.06] bg-white">
            <div className="border-b border-black/[0.06] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">All threads</span>
                <span className="text-xs text-muted-foreground">{DUMMY_THREADS.length} conversations</span>
              </div>
            </div>

            <div className="flex-1 divide-y divide-black/[0.04] overflow-hidden">
              {DUMMY_THREADS.map((thread, idx) => (
                <div
                  key={thread.id}
                  className={`px-4 py-3.5 transition-colors ${
                    idx === 0 ? "bg-foreground/[0.03]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {thread.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                        <span className={`text-sm ${thread.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                          {thread.from}
                        </span>
                        <span className="text-xs text-muted-foreground">· {thread.brand}</span>
                      </div>
                      <p className={`mt-0.5 truncate text-sm ${thread.unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {thread.subject}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                        {thread.preview}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted-foreground">{thread.time}</span>
                      <div className="flex items-center gap-1">
                        {thread.unread && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                        {thread.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground/50" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thread detail / CTA overlay */}
          <div className="relative min-h-[600px] overflow-hidden rounded-xl border border-black/[0.06] bg-white">
            {/* Blurred fake thread detail */}
            <div className="pointer-events-none select-none blur-[3px]">
              <div className="border-b border-black/[0.06] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">Partnership deliverables — March campaign</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sarah Chen · Glossier · 3 messages</p>
              </div>
              <div className="space-y-6 px-6 py-5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-foreground/10" />
                    <div>
                      <p className="text-sm font-medium">Sarah Chen</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 pl-10 text-sm text-muted-foreground">
                    <p>Hi! Just wanted to follow up on the content calendar we discussed last week.</p>
                    <p>The team loved your initial concepts and we'd like to move forward with the Instagram Reels and TikTok series. Attached is the updated brief with revised timelines.</p>
                    <p>Can you confirm the deliverable dates work for your schedule?</p>
                  </div>
                </div>
                <div className="border-t border-black/[0.06] pt-5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-foreground/10" />
                    <div>
                      <p className="text-sm font-medium">You</p>
                      <p className="text-xs text-muted-foreground">1 hour ago</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 pl-10 text-sm text-muted-foreground">
                    <p>Thanks Sarah! I've reviewed the updated brief and the timeline works well.</p>
                    <p>I'll have the first draft of the Reels content ready by next Friday.</p>
                  </div>
                </div>
              </div>

              {/* Action items sidebar */}
              <div className="border-t border-black/[0.06] px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI-detected action items</p>
                <div className="mt-3 space-y-2">
                  {DUMMY_ACTIONS.map((action) => (
                    <div key={action.label} className="flex items-center gap-2 text-sm">
                      <action.icon className={`h-3.5 w-3.5 ${action.tone}`} />
                      <span className="text-foreground">{action.label}</span>
                      <span className="text-muted-foreground">· {action.brand}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upgrade overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="mx-4 max-w-md text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.06]">
                  <InboxIcon className="h-6 w-6 text-foreground/60" />
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
                  Unlock inbox intelligence
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Connect Gmail or Outlook to sync threads, extract action items, and draft negotiation-aware replies — all linked to your partnerships.
                </p>
                <div className="mt-5 flex items-center justify-center gap-4">
                  <Link
                    href="/app/settings/billing"
                    className="group inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
                  >
                    Upgrade to Premium
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
