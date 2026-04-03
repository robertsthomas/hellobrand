import { notFound } from "next/navigation";

import { InboxWorkspace } from "@/components/inbox-workspace";
import { requireViewer } from "@/lib/auth";
import type {
  DealRecord,
  EmailThreadDetail,
  EmailThreadListItem,
  EmailThreadPreviewStateRecord,
  ProfileRecord
} from "@/lib/types";

function buildDeal(id: string, brandName: string, campaignName: string): DealRecord {
  return {
    id,
    userId: "demo-user",
    brandName,
    campaignName,
    status: "negotiating",
    paymentStatus: "awaiting_payment",
    countersignStatus: "pending",
    summary: null,
    legalDisclaimer: "",
    nextDeliverableDate: null,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-02T09:00:00.000Z",
    analyzedAt: null,
    confirmedAt: null,
    statusBeforeArchive: null
  };
}

function buildThreadList(): EmailThreadListItem[] {
  return [
    {
      thread: {
        id: "thread-1",
        accountId: "account-1",
        provider: "gmail",
        providerThreadId: "provider-thread-1",
        subject: "Spring launch usage terms",
        snippet: "Can we confirm the revised timing and usage language?",
        participants: [
          {
            name: "Jamie Park",
            email: "jamie@glossier.com"
          }
        ],
        lastMessageAt: "2026-04-02T09:00:00.000Z",
        messageCount: 2,
        isContractRelated: true,
        aiSummary: null,
        aiSummaryUpdatedAt: null,
        workflowState: "needs_review",
        draftUpdatedAt: null,
        createdAt: "2026-04-01T08:00:00.000Z",
        updatedAt: "2026-04-02T09:00:00.000Z"
      },
      account: {
        id: "account-1",
        userId: "demo-user",
        provider: "gmail",
        providerAccountId: "acct-provider-1",
        emailAddress: "demo@hellobrand.app",
        displayName: "Demo Creator",
        status: "connected",
        scopes: [],
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        mailAuthConfigured: false,
        tokenExpiresAt: null,
        lastSyncAt: "2026-04-02T09:05:00.000Z",
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: "2026-04-01T08:00:00.000Z",
        updatedAt: "2026-04-02T09:05:00.000Z"
      },
      links: [
        {
          id: "link-primary",
          dealId: "deal-1",
          threadId: "thread-1",
          dealName: "Glossier spring launch",
          brandName: "Glossier",
          campaignName: "Spring launch",
          linkSource: "manual",
          role: "primary",
          confidence: 0.98,
          createdAt: "2026-04-02T09:00:00.000Z"
        },
        {
          id: "link-reference",
          dealId: "deal-2",
          threadId: "thread-1",
          dealName: "Sephora evergreen usage",
          brandName: "Sephora",
          campaignName: "Evergreen usage",
          linkSource: "ai_suggested",
          role: "reference",
          confidence: 0.67,
          createdAt: "2026-04-02T09:01:00.000Z"
        }
      ],
      primaryLink: {
        id: "link-primary",
        dealId: "deal-1",
        threadId: "thread-1",
        dealName: "Glossier spring launch",
        brandName: "Glossier",
        campaignName: "Spring launch",
        linkSource: "manual",
        role: "primary",
        confidence: 0.98,
        createdAt: "2026-04-02T09:00:00.000Z"
      },
      referenceLinks: [
        {
          id: "link-reference",
          dealId: "deal-2",
          threadId: "thread-1",
          dealName: "Sephora evergreen usage",
          brandName: "Sephora",
          campaignName: "Evergreen usage",
          linkSource: "ai_suggested",
          role: "reference",
          confidence: 0.67,
          createdAt: "2026-04-02T09:01:00.000Z"
        }
      ],
      importantEventCount: 1,
      latestImportantEventAt: "2026-04-02T09:00:00.000Z",
      pendingTermSuggestionCount: 1,
      pendingActionItemCount: 1,
      latestPendingActionItemAt: "2026-04-02T09:00:00.000Z",
      savedDraft: null,
      noteCount: 1
    },
    {
      thread: {
        id: "thread-2",
        accountId: "account-1",
        provider: "gmail",
        providerThreadId: "provider-thread-2",
        subject: "Need budget confirmation",
        snippet: "Looping back with a few questions on scope.",
        participants: [
          {
            name: "Alex Li",
            email: "alex@nike.com"
          }
        ],
        lastMessageAt: "2026-04-02T07:30:00.000Z",
        messageCount: 1,
        isContractRelated: true,
        aiSummary: null,
        aiSummaryUpdatedAt: null,
        workflowState: "draft_ready",
        draftUpdatedAt: "2026-04-02T07:45:00.000Z",
        createdAt: "2026-04-02T07:00:00.000Z",
        updatedAt: "2026-04-02T07:45:00.000Z"
      },
      account: {
        id: "account-1",
        userId: "demo-user",
        provider: "gmail",
        providerAccountId: "acct-provider-1",
        emailAddress: "demo@hellobrand.app",
        displayName: "Demo Creator",
        status: "connected",
        scopes: [],
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        mailAuthConfigured: false,
        tokenExpiresAt: null,
        lastSyncAt: "2026-04-02T09:05:00.000Z",
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: "2026-04-01T08:00:00.000Z",
        updatedAt: "2026-04-02T09:05:00.000Z"
      },
      links: [],
      primaryLink: null,
      referenceLinks: [],
      importantEventCount: 0,
      latestImportantEventAt: null,
      pendingTermSuggestionCount: 0,
      pendingActionItemCount: 0,
      latestPendingActionItemAt: null,
      savedDraft: {
        id: "draft-2",
        userId: "demo-user",
        threadId: "thread-2",
        subject: "Re: Need budget confirmation",
        body: "Thanks, I can confirm the revised budget once I have the final usage window in writing.",
        status: "ready",
        source: "manual",
        createdAt: "2026-04-02T07:35:00.000Z",
        updatedAt: "2026-04-02T07:45:00.000Z"
      },
      noteCount: 0
    },
    {
      thread: {
        id: "thread-3",
        accountId: "account-1",
        provider: "gmail",
        providerThreadId: "provider-thread-3",
        subject: "New inbound thread",
        snippet: "Would love to talk through a Q2 campaign.",
        participants: [
          {
            name: "Morgan Diaz",
            email: "morgan@adobe.com"
          }
        ],
        lastMessageAt: "2026-04-02T06:00:00.000Z",
        messageCount: 1,
        isContractRelated: false,
        aiSummary: null,
        aiSummaryUpdatedAt: null,
        workflowState: "unlinked",
        draftUpdatedAt: null,
        createdAt: "2026-04-02T06:00:00.000Z",
        updatedAt: "2026-04-02T06:00:00.000Z"
      },
      account: {
        id: "account-1",
        userId: "demo-user",
        provider: "gmail",
        providerAccountId: "acct-provider-1",
        emailAddress: "demo@hellobrand.app",
        displayName: "Demo Creator",
        status: "connected",
        scopes: [],
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        mailAuthConfigured: false,
        tokenExpiresAt: null,
        lastSyncAt: "2026-04-02T09:05:00.000Z",
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: "2026-04-01T08:00:00.000Z",
        updatedAt: "2026-04-02T09:05:00.000Z"
      },
      links: [],
      primaryLink: null,
      referenceLinks: [],
      importantEventCount: 0,
      latestImportantEventAt: null,
      pendingTermSuggestionCount: 0,
      pendingActionItemCount: 0,
      latestPendingActionItemAt: null,
      savedDraft: null,
      noteCount: 0
    }
  ];
}

function buildSelectedThread(): EmailThreadDetail {
  return {
    ...buildThreadList()[0],
    messages: [
      {
        id: "message-1",
        threadId: "thread-1",
        providerMessageId: "provider-message-1",
        internetMessageId: "<message-1@example.com>",
        from: {
          name: "Jamie Park",
          email: "jamie@glossier.com"
        },
        to: [
          {
            name: "Demo Creator",
            email: "demo@hellobrand.app"
          }
        ],
        cc: [],
        bcc: [],
        subject: "Spring launch usage terms",
        textBody:
          "Can you confirm the revised timing and whether the 90-day usage term still applies?",
        htmlBody: null,
        sentAt: null,
        receivedAt: "2026-04-02T08:00:00.000Z",
        direction: "inbound",
        hasAttachments: true,
        rawStorageKey: null,
        createdAt: "2026-04-02T08:00:00.000Z",
        updatedAt: "2026-04-02T08:00:00.000Z",
        attachments: [
          {
            id: "attachment-1",
            messageId: "message-1",
            providerAttachmentId: "provider-attachment-1",
            filename: "updated-brief.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024,
            storageKey: null,
            extractedText: null,
            createdAt: "2026-04-02T08:00:00.000Z"
          }
        ]
      },
      {
        id: "message-2",
        threadId: "thread-1",
        providerMessageId: "provider-message-2",
        internetMessageId: "<message-2@example.com>",
        from: {
          name: "Jamie Park",
          email: "jamie@glossier.com"
        },
        to: [
          {
            name: "Demo Creator",
            email: "demo@hellobrand.app"
          }
        ],
        cc: [],
        bcc: [],
        subject: "Spring launch usage terms",
        textBody:
          "We can move quickly once the reply confirms timing, budget, and the approved attachment set.",
        htmlBody: null,
        sentAt: null,
        receivedAt: "2026-04-02T09:00:00.000Z",
        direction: "inbound",
        hasAttachments: false,
        rawStorageKey: null,
        createdAt: "2026-04-02T09:00:00.000Z",
        updatedAt: "2026-04-02T09:00:00.000Z",
        attachments: []
      }
    ],
    importantEvents: [
      {
        id: "event-1",
        userId: "demo-user",
        dealId: "deal-1",
        threadId: "thread-1",
        messageId: "message-2",
        category: "rights",
        title: "Usage rights or exclusivity update",
        body: "The brand is asking to confirm the revised usage window before moving forward.",
        metadata: {},
        createdAt: "2026-04-02T09:00:00.000Z",
        updatedAt: "2026-04-02T09:00:00.000Z"
      }
    ],
    termSuggestions: [
      {
        id: "term-1",
        userId: "demo-user",
        dealId: "deal-1",
        threadId: "thread-1",
        messageId: "message-2",
        status: "pending",
        title: "Usage term needs review",
        summary: "The thread suggests updated timing that should be reviewed before applying to the workspace.",
        patch: {
          usageTermDays: 90
        },
        evidence: {},
        createdAt: "2026-04-02T09:00:00.000Z",
        updatedAt: "2026-04-02T09:00:00.000Z"
      }
    ],
    actionItems: [
      {
        id: "action-1",
        userId: "demo-user",
        dealId: "deal-1",
        threadId: "thread-1",
        messageId: "message-2",
        action: "Reply with updated timing and confirm attachment set.",
        dueDate: null,
        urgency: "medium",
        status: "pending",
        sourceText: "Please confirm the revised timing and the approved files.",
        createdAt: "2026-04-02T09:00:00.000Z",
        updatedAt: "2026-04-02T09:00:00.000Z"
      }
    ],
    promiseDiscrepancies: [],
    crossDealConflicts: [],
    savedDraft: null,
    notes: [
      {
        id: "note-1",
        userId: "demo-user",
        threadId: "thread-1",
        body: "Hold the reply until the usage window is confirmed against the workspace.",
        createdAt: "2026-04-02T08:30:00.000Z",
        updatedAt: "2026-04-02T08:30:00.000Z"
      }
    ],
    noteCount: 1
  };
}

function buildProfile(): ProfileRecord {
  return {
    id: "profile-1",
    userId: "demo-user",
    displayName: "Demo Creator",
    creatorLegalName: "Demo Creator",
    businessName: "Demo Studio",
    contactEmail: "demo@hellobrand.app",
    timeZone: "America/New_York",
    preferredSignature: "Best,\nDemo Creator",
    payoutDetails: null,
    defaultCurrency: "USD",
    reminderLeadDays: 3,
    conflictAlertsEnabled: true,
    paymentRemindersEnabled: true,
    emailNotificationsEnabled: true,
    accentColor: null,
    createdAt: "2026-04-01T08:00:00.000Z",
    updatedAt: "2026-04-02T08:00:00.000Z"
  };
}

function buildPreviewStates(): Record<string, EmailThreadPreviewStateRecord> {
  return {
    "thread-1": {
      threadId: "thread-1",
      previewUpdatesSeenAt: null,
      previewUpdatesClearedAt: null,
      actionItemsSeenAt: null,
      createdAt: "2026-04-02T08:00:00.000Z",
      updatedAt: "2026-04-02T08:00:00.000Z"
    }
  };
}

export default async function InboxFixturePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  await requireViewer();

  const threads = buildThreadList();
  const selectedThread = buildSelectedThread();

  return (
    <InboxWorkspace
      threads={threads}
      selectedThread={selectedThread}
      threadPreviewStates={buildPreviewStates()}
      deals={[
        buildDeal("deal-1", "Glossier", "Spring launch"),
        buildDeal("deal-2", "Sephora", "Evergreen usage"),
        buildDeal("deal-3", "Adobe", "Q2 campaign")
      ]}
      hasConnectedAccounts
      connectedProviders={["gmail"]}
      profile={buildProfile()}
      invoiceAttachmentsByDealId={{}}
      autoAttachInvoice={false}
      selectedFilters={{
        q: "",
        provider: "",
        accountId: "",
        dealId: "",
        workflowState: ""
      }}
    />
  );
}
