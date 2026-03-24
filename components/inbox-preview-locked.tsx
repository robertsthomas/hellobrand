import Link from "next/link";
import {
  ArrowRight,
  Inbox as InboxIcon,
  Mail,
  Paperclip,
  Sparkles,
  Star,
  Clock,
  AlertCircle
} from "lucide-react";
import { PlanTier } from "@prisma/client";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { InboxPreviewInteraction } from "@/components/inbox-preview-interaction";

type DummyThread = {
  id: string;
  from: string;
  brand: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  hasAttachment: boolean;
  starred: boolean;
  messages: { from: string; isYou: boolean; time: string; lines: string[] }[];
  aiReply: string;
};

const DUMMY_THREADS: DummyThread[] = [
  {
    id: "1",
    from: "Sarah Chen",
    brand: "Glossier",
    subject: "Partnership deliverables: March campaign",
    preview: "Hi! Just wanted to follow up on the content calendar we discussed...",
    time: "2h ago",
    unread: true,
    hasAttachment: true,
    starred: true,
    messages: [
      {
        from: "Sarah Chen",
        isYou: false,
        time: "2 hours ago",
        lines: [
          "Hi! Just wanted to follow up on the content calendar we discussed last week.",
          "The team loved your initial concepts and we'd like to move forward with the Instagram Reels and TikTok series. Attached is the updated brief with revised timelines.",
          "Can you confirm the deliverable dates work for your schedule?"
        ]
      },
      {
        from: "You",
        isYou: true,
        time: "1 hour ago",
        lines: [
          "Thanks Sarah! I've reviewed the updated brief and the timeline works well.",
          "I'll have the first draft of the Reels content ready by next Friday."
        ]
      }
    ],
    aiReply:
      "Hi Sarah, thanks for the update! The revised timeline looks great. I can confirm the deliverable dates work for my schedule. I'll have the Instagram Reels draft ready by March 28th and the TikTok series concepts by April 2nd. Looking forward to it!"
  },
  {
    id: "2",
    from: "Marcus Rivera",
    brand: "Nike",
    subject: "Re: Contract revision, Spring collection",
    preview: "Thanks for sending over the updated terms. I've reviewed the exclusivity...",
    time: "4h ago",
    unread: true,
    hasAttachment: false,
    starred: false,
    messages: [
      {
        from: "Marcus Rivera",
        isYou: false,
        time: "4 hours ago",
        lines: [
          "Thanks for sending over the updated terms. I've reviewed the exclusivity clause and have a few questions.",
          "Could we limit the exclusivity window to 60 days post-campaign instead of 90? That would give us more flexibility."
        ]
      }
    ],
    aiReply:
      "Hi Marcus, thanks for reviewing! I appreciate the flexibility on the exclusivity window. A 60-day post-campaign exclusivity works well for me, it aligns better with my upcoming content calendar. Shall I send over the revised terms with this adjustment?"
  },
  {
    id: "3",
    from: "Emma Walsh",
    brand: "Spotify",
    subject: "Payment confirmation: January invoice",
    preview: "This is to confirm that payment of $4,500 has been processed...",
    time: "Yesterday",
    unread: false,
    hasAttachment: true,
    starred: false,
    messages: [
      {
        from: "Emma Walsh",
        isYou: false,
        time: "Yesterday",
        lines: [
          "This is to confirm that payment of $4,500 has been processed for the January campaign deliverables.",
          "You should see the transfer in your account within 2-3 business days. Invoice attached for your records."
        ]
      }
    ],
    aiReply:
      "Thanks Emma! I've received the confirmation and will keep an eye out for the transfer. Really enjoyed working on the January campaign, looking forward to future collaborations with the Spotify team."
  },
  {
    id: "4",
    from: "Jordan Lee",
    brand: "Adobe",
    subject: "Brief: Creative suite ambassador program",
    preview: "We're excited to share the campaign brief for our upcoming...",
    time: "Yesterday",
    unread: false,
    hasAttachment: true,
    starred: true,
    messages: [
      {
        from: "Jordan Lee",
        isYou: false,
        time: "Yesterday",
        lines: [
          "We're excited to share the campaign brief for our upcoming ambassador program.",
          "We'd love to have you create a series of tutorials showcasing the Creative Suite workflow. Budget and deliverable details are in the attached brief."
        ]
      }
    ],
    aiReply:
      "Hi Jordan, this is exciting! I've reviewed the brief and the ambassador program is a great fit for my content style. I have a few questions about the tutorial format. Would you prefer long-form YouTube content or shorter Reels/TikTok clips? Happy to jump on a quick call to align."
  },
  {
    id: "5",
    from: "Priya Patel",
    brand: "Fenty Beauty",
    subject: "Content approval: Product launch",
    preview: "The team has reviewed your submitted content and we're happy to...",
    time: "2d ago",
    unread: false,
    hasAttachment: false,
    starred: false,
    messages: [
      {
        from: "Priya Patel",
        isYou: false,
        time: "2 days ago",
        lines: [
          "The team has reviewed your submitted content and we're happy to confirm approval for all three deliverables.",
          "Great work on the product photography. The team loved the creative direction. We'll be scheduling the posts for next week."
        ]
      }
    ],
    aiReply:
      "Thank you Priya! So glad the team is happy with the content. I had a lot of fun with the creative direction on this one. Let me know if you need any final tweaks before the posts go live, happy to make adjustments."
  },
  {
    id: "6",
    from: "Alex Thompson",
    brand: "Samsung",
    subject: "Re: Negotiation update, Tech review series",
    preview: "I spoke with the partnerships team and they're open to adjusting...",
    time: "3d ago",
    unread: false,
    hasAttachment: false,
    starred: false,
    messages: [
      {
        from: "Alex Thompson",
        isYou: false,
        time: "3 days ago",
        lines: [
          "I spoke with the partnerships team and they're open to adjusting the usage rights window.",
          "They can do 6 months instead of 12, and are also willing to discuss a performance bonus on top of the base rate if the content exceeds engagement benchmarks."
        ]
      }
    ],
    aiReply:
      "That's great news Alex! The 6-month usage window works much better for me. I'm definitely open to discussing a performance bonus structure, that aligns well with my goals for this partnership. I'm free Thursday afternoon or Friday morning for a call."
  }
];

const DUMMY_ACTIONS = [
  { label: "Review contract terms", brand: "Nike", icon: AlertCircle, tone: "text-amber-600" },
  { label: "Submit March deliverables", brand: "Glossier", icon: Clock, tone: "text-foreground" },
  { label: "Follow up on payment", brand: "Adobe", icon: Mail, tone: "text-red-500" }
];

function ThreadListItem({
  thread,
  isSelected
}: {
  thread: DummyThread;
  isSelected: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full px-4 py-3.5 text-left transition-colors",
        isSelected ? "bg-foreground/[0.04]" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {thread.starred && (
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            )}
            <span
              className={`text-sm ${thread.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}
            >
              {thread.from}
            </span>
            <span className="text-xs text-muted-foreground">
              · {thread.brand}
            </span>
          </div>
          <p
            className={`mt-0.5 truncate text-sm ${thread.unread ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {thread.subject}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
            {thread.preview}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-muted-foreground">
            {thread.time}
          </span>
          <div className="flex items-center gap-1">
            {thread.unread && (
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
            {thread.hasAttachment && (
              <Paperclip className="h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadDetail({ thread }: { thread: DummyThread }) {
  return (
    <>
      <div className="border-b border-black/[0.06] px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">
          {thread.subject}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {thread.from} · {thread.brand} ·{" "}
          {thread.messages.length} message
          {thread.messages.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-5">
          {thread.messages.map((msg, idx) => (
            <div
              key={idx}
              className={idx > 0 ? "border-t border-black/[0.06] pt-5" : ""}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white",
                    msg.isYou ? "bg-primary" : "bg-foreground/20"
                  )}
                >
                  {msg.from[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{msg.from}</p>
                  <p className="text-xs text-muted-foreground">
                    {msg.time}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2 pl-10 text-sm text-muted-foreground">
                {msg.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-black/[0.06] px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI-detected action items
          </p>
          <div className="mt-3 space-y-2">
            {DUMMY_ACTIONS.map((action) => (
              <div
                key={action.label}
                className="flex items-center gap-2 text-sm"
              >
                <action.icon className={`h-3.5 w-3.5 ${action.tone}`} />
                <span className="text-foreground">{action.label}</span>
                <span className="text-muted-foreground">
                  · {action.brand}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function InboxPreviewLocked({
  currentTier,
  hasActiveSubscription
}: {
  currentTier: PlanTier;
  hasActiveSubscription: boolean;
}) {
  const threads = DUMMY_THREADS;

  return (
    <div className="flex h-full min-h-0 flex-col px-5 py-4 lg:px-8 lg:py-5">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] flex-col gap-4">
        {/* Header bar */}
        <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <InboxIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              Inbox
            </h1>
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
        <InboxPreviewInteraction
          threads={threads.map((t) => ({
            id: t.id,
            aiReply: t.aiReply,
            listItem: (
              <ThreadListItem key={t.id} thread={t} isSelected={false} />
            ),
            listItemSelected: (
              <ThreadListItem key={t.id} thread={t} isSelected={true} />
            ),
            detail: <ThreadDetail thread={t} />
          }))}
          upgradeHref="/app/settings/billing"
        />
      </div>
    </div>
  );
}
