/**
 * Right panel: full conversation view with workspace context, preview updates,
 * action items, discrepancies, copilot insights, earlier messages, and the
 * latest message with attachment shelf.
 */
"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  MoreHorizontal,
  ShieldAlert,
} from "lucide-react";
import { InboxActionItemRow } from "@/components/inbox-action-item-row";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  DealRecord,
  EmailActionItemRecord,
  EmailMessageRecord,
  EmailThreadDetail,
  EmailThreadPreviewStateRecord,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  providerLabel,
  workflowStateLabel,
  workflowBadgeClass,
  initialsFromParticipant,
  participantLabel,
} from "./formatters";
import type {
  PreviewUpdateEntry,
  RiskSuggestion,
  DocumentSuggestion,
} from "./helpers";
import {
  EmailMessageBody,
  AttachmentShelf,
  MessageStrip,
} from "./InboxMessageView";

type InboxThreadDetailProps = {
  selectedThread: EmailThreadDetail;
  isThreadLoading: boolean;
  mobileDetailOpen: boolean;
  onMobileBack: () => void;
  isActionMenuOpen: boolean;
  onToggleActionMenu: () => void;
  onSummarizeThread: () => void;
  isSummarizing: boolean;
  hasThreadSummary: boolean;
  onViewSummary: () => void;
  replyStance: string;
  onSetReplyStance: (stance: "firm" | "collaborative" | "exploratory") => void;
  onOpenNotes: () => void;
  onOpenLinkModal: () => void;
  isUpdatingWorkflow: boolean;
  onUpdateWorkflowState: (state: string) => void;
  arePreviewUpdatesOpen: boolean;
  onPreviewUpdatesOpenChange: (open: boolean, hasUnseen: boolean, latestAt: string | null) => void;
  shouldShowPreviewUpdates: boolean;
  selectedThreadUpdates: PreviewUpdateEntry[];
  hasUnseenPreviewUpdates: boolean;
  latestPreviewUpdateAt: string | null;
  onClearPreviewUpdates: (latestAt: string | null) => void;
  areActionItemsOpen: boolean;
  onActionItemsOpenChange: (open: boolean, hasUnseen: boolean, latestAt: string | null) => void;
  hasUnseenActionItems: boolean;
  latestActionItemAt: string | null;
  onGenerateReplyFromActionItem: (item: EmailActionItemRecord) => void;
  isDrafting: boolean;
  currentCopilotInsights: { risks: RiskSuggestion[]; documents: DocumentSuggestion[] };
  earlierMessages: EmailMessageRecord[];
  latestMessage: EmailMessageRecord | null;
  importingAttachmentId: string | null;
  onImportAttachment: (attachmentId: string) => void;
  onPrefetchThread: (threadId: string) => void;
};

export function InboxThreadDetail({
  selectedThread,
  isThreadLoading,
  mobileDetailOpen: _mobileDetailOpen,
  onMobileBack,
  isActionMenuOpen,
  onToggleActionMenu,
  onSummarizeThread,
  isSummarizing,
  hasThreadSummary,
  onViewSummary,
  replyStance,
  onSetReplyStance,
  onOpenNotes,
  onOpenLinkModal,
  isUpdatingWorkflow,
  onUpdateWorkflowState,
  arePreviewUpdatesOpen,
  onPreviewUpdatesOpenChange,
  shouldShowPreviewUpdates,
  selectedThreadUpdates,
  hasUnseenPreviewUpdates,
  latestPreviewUpdateAt,
  onClearPreviewUpdates,
  areActionItemsOpen,
  onActionItemsOpenChange,
  hasUnseenActionItems,
  latestActionItemAt,
  onGenerateReplyFromActionItem,
  isDrafting,
  currentCopilotInsights,
  earlierMessages,
  latestMessage,
  importingAttachmentId,
  onImportAttachment,
  onPrefetchThread: _onPrefetchThread,
}: InboxThreadDetailProps) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden border border-black/8 bg-white xl:mr-28 dark:border-white/10 dark:bg-white/[0.03]`}
    >
      <div className="shrink-0 border-b border-black/8 px-6 py-5 dark:border-white/10">
        <button
          type="button"
          onClick={onMobileBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground xl:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to threads
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground shadow-sm">
                {providerLabel(selectedThread.account.provider)}
              </span>
              <span className="bg-white px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                {selectedThread.account.emailAddress}
              </span>
              <span
                className={`px-3 py-1 text-[10px] font-medium ${workflowBadgeClass(
                  selectedThread.thread.workflowState
                )}`}
              >
                {workflowStateLabel(selectedThread.thread.workflowState)}
              </span>
            </div>
            <h2 className="mt-3 max-w-4xl text-[22px] font-semibold tracking-[-0.04em] text-foreground">
              {selectedThread.thread.subject}
            </h2>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={onToggleActionMenu}
              className="inline-flex h-8 w-8 items-center justify-center border border-black/10 text-foreground transition hover:border-black/20"
              aria-label="Thread actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isActionMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 border border-black/8 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#161a20]">
                <button
                  type="button"
                  onClick={() => {
                    onToggleActionMenu();
                    if (hasThreadSummary) {
                      onViewSummary();
                      return;
                    }
                    onSummarizeThread();
                  }}
                  disabled={isSummarizing && !hasThreadSummary}
                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSummarizing && !hasThreadSummary
                    ? "Summarizing..."
                    : hasThreadSummary
                      ? "View summary"
                      : "Generate summary"}
                </button>
                <div className="border-b border-black/6 pb-1 mb-1">
                  <p className="px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Reply style
                  </p>
                  <div className="flex gap-1 px-3 py-1">
                    {(["firm", "collaborative", "exploratory"] as const).map(
                      (s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onSetReplyStance(s)}
                          className={`px-2 py-1 text-[10px] font-medium transition ${
                            replyStance === s
                              ? "bg-foreground text-background"
                              : "bg-secondary/60 text-foreground hover:bg-secondary/85"
                          }`}
                        >
                          {s === "firm"
                            ? "Direct"
                            : s === "exploratory"
                              ? "Clarifying"
                              : "Balanced"}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onToggleActionMenu();
                    onOpenNotes();
                  }}
                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80"
                >
                  Private notes
                  {selectedThread.noteCount > 0
                    ? ` (${selectedThread.noteCount})`
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleActionMenu();
                    onOpenLinkModal();
                  }}
                  className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80"
                >
                  Link partnership
                </button>
                <div className="border-t border-black/6 pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleActionMenu();
                      onUpdateWorkflowState("needs_review");
                    }}
                    disabled={isUpdatingWorkflow}
                    className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:opacity-60"
                  >
                    Mark needs review
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleActionMenu();
                      onUpdateWorkflowState("waiting_on_them");
                    }}
                    disabled={isUpdatingWorkflow}
                    className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:opacity-60"
                  >
                    Mark waiting
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleActionMenu();
                      onUpdateWorkflowState("closed");
                    }}
                    disabled={isUpdatingWorkflow}
                    className="block w-full px-3 py-2 text-left text-[12px] text-foreground transition hover:bg-secondary/80 disabled:opacity-60"
                  >
                    Mark closed
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {isThreadLoading ? (
              <div className="border border-black/8 px-5 py-4 text-[12px] text-muted-foreground">
                Loading thread...
              </div>
            ) : null}

            <section className="border border-black/6 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Workspace context
              </p>
              <div className="mt-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">
                      Primary workspace
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {selectedThread.primaryLink
                        ? `${selectedThread.primaryLink.campaignName} · ${selectedThread.primaryLink.brandName}`
                        : "No primary workspace linked yet."}
                    </p>
                  </div>
                  {selectedThread.primaryLink ? (
                    <span className="bg-[#eff6ff] px-2.5 py-1 text-[10px] font-medium text-[#1d4ed8]">
                      Primary
                    </span>
                  ) : null}
                </div>
                {selectedThread.referenceLinks.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      References
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedThread.referenceLinks.map((link) => (
                        <span
                          key={link.id}
                          className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                        >
                          {link.campaignName}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedThread.savedDraft ? (
                  <div className="border-t border-black/6 pt-3 text-[12px] text-muted-foreground">
                    Saved draft status:{" "}
                    <span className="font-medium text-foreground">
                      {selectedThread.savedDraft.status === "ready"
                        ? "Ready"
                        : "In progress"}
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            {shouldShowPreviewUpdates ? (
              <Collapsible
                open={arePreviewUpdatesOpen}
                onOpenChange={(open) =>
                  onPreviewUpdatesOpenChange(
                    open,
                    hasUnseenPreviewUpdates,
                    latestPreviewUpdateAt
                  )
                }
              >
                <section className="border border-black/6 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center justify-between text-left"
                        aria-label={
                          arePreviewUpdatesOpen
                            ? "Collapse preview updates"
                            : "Expand preview updates"
                        }
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                            Updates
                          </p>
                          {hasUnseenPreviewUpdates ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                          ) : null}
                        </div>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                            arePreviewUpdatesOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <button
                      type="button"
                      onClick={() => onClearPreviewUpdates(latestPreviewUpdateAt)}
                      disabled={hasUnseenPreviewUpdates}
                      className="shrink-0 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {selectedThreadUpdates.map((update) => (
                      <div
                        key={update.id}
                        className="border-l-2 border-black/8 pl-3"
                      >
                        <p className="text-[12px] font-medium text-foreground">
                          {update.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {update.body}
                        </p>
                        {update.href && update.ctaLabel ? (
                          <a
                            href={update.href}
                            className="mt-1 inline-flex text-[11px] font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {update.ctaLabel}
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </CollapsibleContent>
                </section>
              </Collapsible>
            ) : null}

            {selectedThread.actionItems.length > 0 ? (
              <Collapsible
                open={areActionItemsOpen}
                onOpenChange={(open) =>
                  onActionItemsOpenChange(
                    open,
                    hasUnseenActionItems,
                    latestActionItemAt
                  )
                }
              >
                <section className="border border-black/6 px-4 py-3">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      aria-label={
                        areActionItemsOpen
                          ? "Collapse action items"
                          : "Expand action items"
                      }
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          Action items ({selectedThread.actionItems.length})
                        </p>
                        {hasUnseenActionItems ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                        ) : null}
                      </div>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                          areActionItemsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {selectedThread.actionItems.map((item) => (
                      <InboxActionItemRow
                        key={item.id}
                        item={item}
                        onGenerateReply={(actionItem) => {
                          onGenerateReplyFromActionItem(actionItem);
                        }}
                        isGeneratingReply={isDrafting}
                      />
                    ))}
                  </CollapsibleContent>
                </section>
              </Collapsible>
            ) : null}

            {selectedThread.promiseDiscrepancies.length > 0 ? (
              <section className="border border-black/6 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Discrepancies
                </p>
                <div className="mt-2 space-y-2">
                  {selectedThread.promiseDiscrepancies.map((d, i) => (
                    <div
                      key={`${d.field}-${i}`}
                      className="border-l-2 border-amber-300 pl-3"
                    >
                      <p className="text-[12px] font-medium text-foreground">
                        {d.field}: email says &ldquo;{d.emailClaim}&rdquo;
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Contract says &ldquo;{d.contractValue}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedThread.crossDealConflicts.length > 0 ? (
              <section className="border border-[#fecaca]/60 bg-[#fef2f2] px-5 py-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#dc2626]" />
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#dc2626]">
                    Cross-deal conflicts
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  {selectedThread.crossDealConflicts.map((conflict, i) => (
                    <div
                      key={`conflict-${i}`}
                      className="border-l-2 border-[#ef4444] pl-3"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold text-foreground">
                          {conflict.title}
                        </p>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium ${
                            conflict.severity === "high"
                              ? "bg-[#fecaca] text-[#991b1b]"
                              : conflict.severity === "medium"
                                ? "bg-[#fef3c7] text-[#92400e]"
                                : "bg-[#e0e7ff] text-[#3730a3]"
                          }`}
                        >
                          {conflict.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {conflict.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {currentCopilotInsights.risks.length > 0 ||
            currentCopilotInsights.documents.length > 0 ? (
              <section className="border border-black/6 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Copilot context
                </p>
                {currentCopilotInsights.risks.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {currentCopilotInsights.risks.map((risk) => (
                      <div
                        key={risk.id}
                        className="border-l-2 border-black/8 pl-3"
                      >
                        <p className="text-[12px] font-medium text-foreground">
                          {risk.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {risk.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {currentCopilotInsights.documents.length > 0 ? (
                  <div className="mt-3 border-t border-black/6 pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Suggested documents
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {currentCopilotInsights.documents.map((document) => (
                        <span
                          key={document.id}
                          className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                        >
                          {document.fileName}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {earlierMessages.length > 0 ? (
              <section className="space-y-3">
                {earlierMessages.map((message) => (
                  <MessageStrip
                    key={message.id}
                    message={message}
                    isOutbound={message.direction === "outbound"}
                    onImportAttachment={
                      selectedThread.primaryLink &&
                      message.direction === "inbound"
                        ? onImportAttachment
                        : undefined
                    }
                    importingAttachmentId={importingAttachmentId}
                  />
                ))}
              </section>
            ) : null}

            {latestMessage ? (
              <section className="bg-white">
                <div className="border-b border-black/8 px-6 py-3">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center text-sm font-semibold ${
                        latestMessage.direction === "outbound"
                          ? "bg-foreground text-background"
                          : "bg-secondary/60 text-foreground"
                      }`}
                    >
                      {latestMessage.direction === "outbound"
                        ? "You"
                        : initialsFromParticipant(latestMessage.from)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-foreground">
                        {latestMessage.direction === "outbound"
                          ? "You"
                          : participantLabel(latestMessage.from)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {latestMessage.direction === "outbound"
                          ? `To: ${latestMessage.to.map(participantLabel).join(", ")}`
                          : latestMessage.from?.email || ""}
                      </p>
                    </div>

                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatDate(
                        latestMessage.receivedAt || latestMessage.sentAt
                      )}
                    </p>
                  </div>
                </div>

                <div className="px-8 py-7">
                  <EmailMessageBody message={latestMessage} />

                  <AttachmentShelf
                    attachments={latestMessage.attachments}
                    onImportAttachment={
                      selectedThread.primaryLink &&
                      latestMessage.direction === "inbound"
                        ? onImportAttachment
                        : undefined
                    }
                    importingAttachmentId={importingAttachmentId}
                  />
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
