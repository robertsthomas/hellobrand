/**
 * This file runs the inbox workspace UI as a composition-only orchestrator.
 * It owns client state, effects, and callbacks while delegating rendering to
 * focused subcomponents under components/inbox-workspace/.
 *
 * Rendering is split into:
 *  - InboxThreadList: left panel thread list
 *  - InboxThreadDetail: right panel conversation view
 *  - InboxReplyComposer: reply composer + AI drafting controls
 *
 * Pure helpers live in ./formatters.ts and ./helpers.ts
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { Inbox, Info, MailSearch, Plus, X, XCircle } from "lucide-react";

import { AppTooltip } from "@/components/app-tooltip";
import { InboxFilterDialog } from "@/components/inbox-filter-dialog";
import { InboxPrivateNotesDialog } from "@/components/inbox-private-notes-dialog";
import { InboxSelect } from "@/components/inbox-select";
import { InboxSortDialog } from "@/components/inbox-sort-dialog";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { captureAppEvent } from "@/lib/posthog/events";
import { useInboxAiSuggestions } from "@/components/use-inbox-ai-suggestions";
import { useInboxCandidateDiscovery } from "@/components/use-inbox-candidate-discovery";
import { useInboxManualAdd } from "@/components/use-inbox-manual-add";
import { useInboxReplyComposer } from "@/components/use-inbox-reply-composer";
import { useInboxThreadDetailState } from "@/components/use-inbox-thread-detail-state";
import { useInboxThreadSelection } from "@/components/use-inbox-thread-selection";
import { useElementWidth } from "@/components/use-element-width";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  normalizeInboxSort,
  sortInboxThreadItems,
  type InboxSortOption,
} from "@/lib/email/inbox-sort";
import { buildReplySuggestionThreadVersion } from "@/lib/email/reply-suggestion-version";
import type {
  DealRecord,
  EmailActionItemRecord,
  EmailThreadDetail,
  EmailThreadListItem,
  NegotiationStance,
  ProfileRecord,
} from "@/lib/types";

import { inboxSortLabel, providerLabel } from "./inbox-workspace/formatters";
import {
  type PreviewUpdateEntry,
  type ThreadInvoiceAttachment,
  buildActionItemReplyPrompt,
  cleanWorkspaceText,
  combineEventUpdateTitles,
  hasUnseenPreviewSection,
  INBOX_SIGNATURE_BANNER_DISMISS_KEY,
  isLegacyThreadSummary,
  isPreviewSectionCleared,
  latestUpdatedAt,
  missingReplySignatureFields,
  normalizePreviewUpdateBody,
  THREAD_ACTION_BUTTON_CLASS,
  threadSearchText,
} from "./inbox-workspace/helpers";
import { InboxThreadList } from "./inbox-workspace/InboxThreadList";
import { InboxThreadDetail } from "./inbox-workspace/InboxThreadDetail";
import { InboxReplyComposer } from "./inbox-workspace/InboxReplyComposer";
import { ThreadAttachments } from "./inbox-workspace/ThreadAttachments";

export function InboxWorkspace({
  threads,
  selectedThread: initialSelectedThread,
  threadPreviewStates: initialThreadPreviewStates,
  deals,
  hasConnectedAccounts,
  connectedProviders,
  profile,
  invoiceAttachmentsByDealId,
  autoAttachInvoice,
  selectedFilters,
}: {
  threads: EmailThreadListItem[];
  selectedThread: EmailThreadDetail | null;
  threadPreviewStates: Record<string, import("@/lib/types").EmailThreadPreviewStateRecord>;
  deals: DealRecord[];
  hasConnectedAccounts: boolean;
  connectedProviders: string[];
  profile: ProfileRecord | null;
  invoiceAttachmentsByDealId: Record<string, ThreadInvoiceAttachment>;
  autoAttachInvoice: boolean;
  selectedFilters: {
    q: string;
    provider: string;
    accountId: string;
    dealId: string;
    workflowState: string;
    sort: InboxSortOption;
  };
}) {
  const router = useRouter();
  const posthog = usePostHog();
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState(selectedFilters.q);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isSortDialogOpen, setIsSortDialogOpen] = useState(false);
  const [draftProviderFilter, setDraftProviderFilter] = useState(selectedFilters.provider);
  const [draftDealFilter, setDraftDealFilter] = useState(selectedFilters.dealId);
  const [draftWorkflowFilter, setDraftWorkflowFilter] = useState(selectedFilters.workflowState);
  const [draftSort, setDraftSort] = useState<InboxSortOption>(selectedFilters.sort);
  const [isReplySignatureBannerVisible, setIsReplySignatureBannerVisible] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(!!initialSelectedThread);
  const [noteBody, setNoteBody] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [importingAttachmentId, setImportingAttachmentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isInvoiceAttached, setIsInvoiceAttached] = useState(false);
  const {
    candidateGroups,
    cancelDiscovery,
    closeCandidateModal,
    discoverCandidates,
    dismissCandidate,
    isCandidateModalOpen,
    isDiscovering,
    isReviewingCandidates,
    choosePrimaryCandidate,
    primaryCandidateId,
    reviewCandidates,
    selectedCandidateIds,
    toggleCandidate,
  } = useInboxCandidateDiscovery({
    onErrorMessage: setErrorMessage,
    onRefresh: () => router.refresh(),
  });
  const {
    activeThreadId,
    isThreadLoading,
    loadThread: loadSelectedThread,
    prefetchThread,
    selectedThread,
    selectedThreadId,
  } = useInboxThreadSelection({
    initialSelectedThread,
    onErrorMessage: setErrorMessage,
    threads,
  });
  const linkedDealIds = useMemo(
    () => new Set(selectedThread?.links.map((link) => link.dealId) ?? []),
    [selectedThread]
  );
  const {
    areActionItemsOpen,
    arePreviewUpdatesOpen,
    clearPreviewUpdates,
    handleActionItemsOpenChange,
    handlePreviewUpdatesOpenChange,
    isLinkModalOpen,
    isLinking,
    isSummarizing,
    isSummaryDialogOpen,
    isUpdatingWorkflow,
    linkSelectedDeal,
    selectedDealId,
    selectedLinkRole,
    setLinkModalOpen,
    setSelectedDealId,
    setSelectedLinkRole,
    setSummaryDialogOpen,
    summarizeThread,
    summary,
    threadPreviewStates,
    updateWorkflowState,
  } = useInboxThreadDetailState({
    initialSelectedThread,
    initialThreadPreviewStates,
    linkedDealIds,
    onErrorMessage: setErrorMessage,
    onRefresh: () => router.refresh(),
    selectedThread,
    selectedThreadId,
  });
  const {
    draft,
    replySubject,
    replyBody,
    replyJourney,
    isDrafting,
    replyStance,
    isPromptCommandOpen,
    draftInstructions,
    openRefinementPopover,
    trimmedDraftInstructions,
    shouldHighlightAiReply,
    canRefineGeneratedReply,
    canClearReplyText,
    canSendReply,
    isSavingDraft,
    replyBodyRef,
    setReplyStance,
    setPromptCommandOpen,
    setDraftInstructions,
    setOpenRefinementPopover,
    handleReplyBodyChange,
    applyPromptToNextDraft,
    clearPromptDialog,
    saveDraft,
    draftReply,
    usePromptForDraft: runPromptForDraft,
    cancelDraftReply,
    clearDraftComposer,
    refineGeneratedDraft,
  } = useInboxReplyComposer({
    selectedDealId,
    selectedThread,
    setErrorMessage,
  });

  const selectedThreadSuggestionVersion = useMemo(
    () => (selectedThread ? buildReplySuggestionThreadVersion(selectedThread.thread) : null),
    [
      selectedThread?.thread.updatedAt,
      selectedThread?.thread.lastMessageAt,
      selectedThread?.thread.messageCount,
    ]
  );

  const {
    prefetch: prefetchThreadSuggestions,
    currentSuggestions: currentAiSuggestions,
    currentCopilotInsights,
    isLoading: isLoadingSuggestions,
  } = useInboxAiSuggestions({
    selectedThread,
    selectedThreadSuggestionVersion,
    isPromptCommandOpen,
  });

  const {
    isOpen: isManualAddModalOpen,
    open: openManualAddModal,
    close: closeManualAddModal,
    dealId: manualAddDealId,
    setDealId: setManualAddDealId,
    query: manualAddQuery,
    setQuery: setManualAddQuery,
    providerFilter: manualAddProviderFilter,
    setProviderFilter: setManualAddProviderFilter,
    threads: manualAddThreads,
    filteredThreads: manualAddFilteredThreads,
    selectedThreadIdSet: selectedManualThreadIdSet,
    selectedThreadIds: manualAddSelectedThreadIds,
    selectedThreads: selectedManualThreads,
    toggleThread: toggleManualAddThread,
    isLoading: isManualAddLoading,
    isSubmitting: isManualAddSubmitting,
    isCreatingWorkspace: isManualAddCreatingWorkspace,
    submit: submitManualAddThreads,
    createWorkspace: createWorkspaceFromSelectedThreads,
    linkableDeals,
  } = useInboxManualAdd({
    deals,
    onErrorMessage: setErrorMessage,
    selectedFilterDealId: selectedFilters.dealId,
  });

  const [aiReplyControlRef, aiReplyMenuWidth] = useElementWidth<HTMLDivElement>([
    replyJourney,
    isDrafting,
  ]);
  const [promptActionControlRef, promptActionMenuWidth] = useElementWidth<HTMLDivElement>([
    draftInstructions,
    isDrafting,
  ]);

  useEffect(() => {
    setErrorMessage(null);
    setIsActionMenuOpen(false);
    setIsNotesDialogOpen(false);
    setNoteBody("");
  }, [selectedThread]);

  useEffect(() => {
    if (!isFilterDialogOpen) {
      return;
    }

    setDraftProviderFilter(selectedFilters.provider);
    setDraftDealFilter(selectedFilters.dealId);
    setDraftWorkflowFilter(selectedFilters.workflowState);
  }, [
    isFilterDialogOpen,
    selectedFilters.dealId,
    selectedFilters.provider,
    selectedFilters.workflowState,
  ]);

  useEffect(() => {
    if (!isSortDialogOpen) {
      return;
    }

    setDraftSort(selectedFilters.sort);
  }, [isSortDialogOpen, selectedFilters.sort]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedMessages = selectedThread?.messages ?? [];
  const latestMessage = selectedMessages[selectedMessages.length - 1] ?? null;
  const earlierMessages = latestMessage ? selectedMessages.slice(0, -1) : [];
  const hasLinkedThreads = threads.length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredThreads = useMemo(() => {
    const nextThreads = normalizedQuery
      ? threads.filter((item) => threadSearchText(item).includes(normalizedQuery))
      : threads;

    return sortInboxThreadItems(nextThreads, normalizeInboxSort(selectedFilters.sort));
  }, [normalizedQuery, selectedFilters.sort, threads]);
  const activeFilterCount = [
    selectedFilters.provider,
    selectedFilters.dealId,
    selectedFilters.workflowState,
  ].filter(Boolean).length;
  const selectedThreadDeals = useMemo(() => {
    const byId = new Map(deals.map((deal) => [deal.id, deal]));
    return selectedThread
      ? [selectedThread.primaryLink, ...selectedThread.referenceLinks]
          .filter((link): link is NonNullable<typeof selectedThread.primaryLink> => Boolean(link))
          .map((link) => byId.get(link.dealId))
          .filter((entry): entry is DealRecord => Boolean(entry))
      : [];
  }, [deals, selectedThread]);
  const selectedThreadInvoiceAttachment = useMemo(() => {
    if (!selectedThread) {
      return null;
    }

    if (selectedDealId && invoiceAttachmentsByDealId[selectedDealId]) {
      return invoiceAttachmentsByDealId[selectedDealId] ?? null;
    }

    for (const link of [selectedThread.primaryLink, ...selectedThread.referenceLinks]) {
      if (!link) {
        continue;
      }

      const attachment = invoiceAttachmentsByDealId[link.dealId];
      if (attachment) {
        return attachment;
      }
    }

    return null;
  }, [invoiceAttachmentsByDealId, selectedDealId, selectedThread]);
  const selectedThreadPreviewState = selectedThread
    ? (threadPreviewStates[selectedThread.thread.id] ?? null)
    : null;
  const selectedThreadUpdates = useMemo<PreviewUpdateEntry[]>(() => {
    if (!selectedThread) {
      return [];
    }

    const eventGroups = new Map<
      string,
      {
        id: string;
        titles: string[];
        body: string;
        updatedAt: string;
      }
    >();

    for (const event of selectedThread.importantEvents) {
      const body = cleanWorkspaceText(event.body);
      const dedupeKey = `${event.messageId}:${normalizePreviewUpdateBody(body)}`;
      const existing = eventGroups.get(dedupeKey);

      if (existing) {
        existing.titles.push(event.title);
        if (event.updatedAt > existing.updatedAt) {
          existing.updatedAt = event.updatedAt;
        }
        continue;
      }

      eventGroups.set(dedupeKey, {
        id: `event:${event.id}`,
        titles: [event.title],
        body,
        updatedAt: event.updatedAt,
      });
    }

    const eventUpdates = Array.from(eventGroups.values()).map((event) => ({
      id: event.id,
      title: combineEventUpdateTitles(event.titles),
      body: event.body,
      updatedAt: event.updatedAt,
    }));

    const termUpdates = selectedThread.termSuggestions.map((suggestion) => ({
      id: `term:${suggestion.id}`,
      title: suggestion.title,
      body: suggestion.summary,
      updatedAt: suggestion.updatedAt,
      href: `/app/p/${suggestion.dealId}?tab=terms`,
      ctaLabel: "Review terms",
    }));

    return [...eventUpdates, ...termUpdates].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }, [selectedThread]);
  const latestPreviewUpdateAt = useMemo(
    () => latestUpdatedAt(selectedThreadUpdates),
    [selectedThreadUpdates]
  );
  const latestActionItemAt = useMemo(
    () => latestUpdatedAt(selectedThread?.actionItems ?? []),
    [selectedThread?.actionItems]
  );
  const hasUnseenPreviewUpdates = hasUnseenPreviewSection(
    latestPreviewUpdateAt,
    selectedThreadPreviewState?.previewUpdatesSeenAt
  );
  const arePreviewUpdatesCleared = isPreviewSectionCleared(
    latestPreviewUpdateAt,
    selectedThreadPreviewState?.previewUpdatesClearedAt
  );
  const shouldShowPreviewUpdates = selectedThreadUpdates.length > 0 && !arePreviewUpdatesCleared;
  const hasUnseenActionItems = hasUnseenPreviewSection(
    latestActionItemAt,
    selectedThreadPreviewState?.actionItemsSeenAt
  );
  const replySignatureMissingFields = useMemo(
    () => missingReplySignatureFields(profile),
    [profile]
  );
  const replySignatureBannerStateKey = useMemo(
    () => replySignatureMissingFields.join("|"),
    [replySignatureMissingFields]
  );
  const canAttachInvoice =
    Boolean(selectedThreadInvoiceAttachment) &&
    selectedThreadInvoiceAttachment?.status !== "voided";
  const hasThreadSummary = Boolean(summary?.trim()) && !isLegacyThreadSummary(summary);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!replySignatureBannerStateKey) {
      setIsReplySignatureBannerVisible(false);
      window.localStorage.removeItem(INBOX_SIGNATURE_BANNER_DISMISS_KEY);
      return;
    }

    const dismissedState = window.localStorage.getItem(INBOX_SIGNATURE_BANNER_DISMISS_KEY);
    setIsReplySignatureBannerVisible(dismissedState !== replySignatureBannerStateKey);
  }, [replySignatureBannerStateKey]);

  useEffect(() => {
    setIsInvoiceAttached(Boolean(autoAttachInvoice && canAttachInvoice));
  }, [autoAttachInvoice, canAttachInvoice, selectedThread?.thread.id]);

  const sendReply = useCallback(async () => {
    if (!selectedThread || !canSendReply) {
      return;
    }

    setIsSendingReply(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/email/threads/${selectedThread.thread.id}/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dealId: isInvoiceAttached
            ? (selectedThreadInvoiceAttachment?.dealId ?? selectedDealId) || null
            : selectedDealId || null,
          subject: replySubject,
          body: replyBody,
          attachmentDocumentIds:
            isInvoiceAttached && selectedThreadInvoiceAttachment
              ? [selectedThreadInvoiceAttachment.documentId]
              : [],
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send reply.");
      }

      clearDraftComposer();
      setIsInvoiceAttached(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send reply.");
    } finally {
      setIsSendingReply(false);
    }
  }, [
    canSendReply,
    clearDraftComposer,
    isInvoiceAttached,
    replyBody,
    replySubject,
    router,
    selectedDealId,
    selectedThread,
    selectedThreadInvoiceAttachment,
  ]);

  const generateReplyFromActionItem = useCallback(
    async (item: EmailActionItemRecord) => {
      await runPromptForDraft(buildActionItemReplyPrompt(item));
      replyBodyRef.current?.focus();
    },
    [replyBodyRef, runPromptForDraft]
  );

  const savePrivateNote = useCallback(async () => {
    if (!selectedThread || !noteBody.trim()) {
      return;
    }

    setIsSavingNote(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/email/threads/${selectedThread.thread.id}/notes`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          body: noteBody.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save note.");
      }
      setNoteBody("");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save note.");
    } finally {
      setIsSavingNote(false);
    }
  }, [noteBody, router, selectedThread]);

  const importAttachmentToWorkspace = useCallback(
    async (attachmentId: string) => {
      if (!selectedThread || !selectedThread.primaryLink?.dealId) {
        return;
      }

      setImportingAttachmentId(attachmentId);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/email/attachments/${attachmentId}/import`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            dealId: selectedThread.primaryLink.dealId,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not import attachment.");
        }
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not import attachment.");
      } finally {
        setImportingAttachmentId(null);
      }
    },
    [router, selectedThread]
  );

  const promptSuggestions = useMemo(() => {
    if (currentAiSuggestions.length > 0) {
      return currentAiSuggestions;
    }

    return [
      {
        id: "fallback-0",
        label: "Ask for more details on deliverables",
        prompt: "Ask the brand to clarify the deliverables, timeline, or creative direction.",
      },
      {
        id: "fallback-1",
        label: "Push back on the terms politely",
        prompt: "Politely push back on terms that feel unfavorable. Suggest alternatives.",
      },
      {
        id: "fallback-2",
        label: "Confirm availability and interest",
        prompt: "Write a brief reply confirming availability and interest without overcommitting.",
      },
    ].slice(0, 3);
  }, [currentAiSuggestions]);
  function buildInboxUrl(next: Partial<typeof selectedFilters> & { thread?: string } = {}) {
    const params = new URLSearchParams();
    const values = {
      ...selectedFilters,
      q: query.trim(),
      ...next,
    };

    for (const [key, value] of Object.entries(values)) {
      if (value) {
        params.set(key, value);
      }
    }

    if (values.thread) {
      params.set("thread", values.thread);
    }

    return `/app/inbox${params.size > 0 ? `?${params.toString()}` : ""}`;
  }

  function applyFilters(next: Partial<typeof selectedFilters> & { thread?: string } = {}) {
    router.push(buildInboxUrl({ ...next, thread: next.thread ?? selectedThreadId }));
  }

  function applyDialogFilters() {
    setIsFilterDialogOpen(false);
    applyFilters({
      provider: draftProviderFilter,
      dealId: draftDealFilter,
      workflowState: draftWorkflowFilter,
      thread: "",
    });
  }

  function clearDialogFilters() {
    setDraftProviderFilter("");
    setDraftDealFilter("");
    setDraftWorkflowFilter("");
  }

  function applyDialogSort() {
    setIsSortDialogOpen(false);
    applyFilters({
      sort: draftSort,
      thread: "",
    });
  }

  async function loadThread(threadId: string) {
    if (!threadId || threadId === selectedThreadId) {
      setMobileDetailOpen(true);
      return;
    }

    window.history.replaceState(null, "", buildInboxUrl({ thread: threadId }));
    setMobileDetailOpen(true);
    await loadSelectedThread(threadId);
  }

  if (deals.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col px-5 py-4 lg:px-8 lg:py-5">
        <div className="mx-auto w-full max-w-[1520px]">
          <h1 className="text-[31px] font-semibold tracking-[-0.05em] text-foreground lg:text-[36px]">
            Inbox
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Your inbox will show email threads linked to your partnerships.
          </p>
          <div className="mt-12 flex flex-col items-center text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-foreground">No workspaces yet</p>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Create a workspace first, then connect your email to start matching threads to your
              deals.
            </p>
            <Link
              href="/app/intake/new"
              onClick={() =>
                captureAppEvent(posthog, "workspace_entry_cta_clicked", {
                  source: "inbox_empty_state",
                })
              }
              className="mt-5 inline-flex h-10 items-center gap-2 bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-5 py-4 lg:px-8 lg:py-5">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] flex-col gap-4">
          <div className="border-b border-black/8 pb-4 dark:border-white/10">
            <div className="flex flex-wrap items-end justify-end gap-3">
              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div className="w-full max-w-sm sm:w-[20rem]">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search linked emails"
                    aria-label="Search linked emails"
                    className="h-9 rounded-none border-black/10 bg-white text-[12px] shadow-none dark:border-white/10 dark:bg-[#161a1f]"
                  />
                </div>
                {hasConnectedAccounts && hasLinkedThreads ? (
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <AppTooltip content="Find emails" sideOffset={8}>
                      <button
                        type="button"
                        onClick={() => void discoverCandidates()}
                        disabled={isDiscovering}
                        aria-label={isDiscovering ? "Finding emails" : "Find emails"}
                        className="inline-flex h-9 items-center justify-center px-1 text-foreground transition hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-white/70"
                      >
                        <MailSearch
                          strokeWidth={1.5}
                          className={`h-5 w-5 shrink-0 ${isDiscovering ? "animate-pulse" : ""}`}
                        />
                      </button>
                    </AppTooltip>
                    <button
                      type="button"
                      onClick={() => openManualAddModal()}
                      className={`${THREAD_ACTION_BUTTON_CLASS} min-w-[8.75rem] shrink-0`}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      Add threads
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {!hasLinkedThreads ? (
            <section className="flex min-h-0 flex-1 items-center justify-center border border-black/8 bg-white px-8 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <div className="max-w-xl">
                <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                  Smart inbox
                </p>
                <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
                  Build your deal inbox
                </h2>
                <p className="mt-4 text-[14px] leading-7 text-muted-foreground">
                  Search connected inboxes, review likely matches, and keep this inbox focused on
                  linked deal conversations.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {hasConnectedAccounts ? (
                    <>
                      <AppTooltip
                        content="We search recent synced mail first, then keep expanding in the background."
                        sideOffset={8}
                      >
                        <button
                          type="button"
                          onClick={() => void discoverCandidates()}
                          disabled={isDiscovering}
                          aria-label="Find emails"
                          className="inline-flex h-12 min-w-[15rem] items-center justify-center gap-2 border border-black/10 px-6 text-[13px] font-semibold text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span>{isDiscovering ? "Finding emails..." : "Find emails"}</span>
                          <Info className="h-4 w-4 shrink-0 text-[#98a2b3]" />
                        </button>
                      </AppTooltip>
                      <button
                        type="button"
                        onClick={() => openManualAddModal()}
                        className={`${THREAD_ACTION_BUTTON_CLASS} min-w-[10rem]`}
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        Add threads manually
                      </button>
                    </>
                  ) : (
                    <a
                      href="/app/settings"
                      onClick={() =>
                        captureAppEvent(posthog, "inbox_connect_email_clicked", {
                          source: "inbox_empty_state",
                        })
                      }
                      className="inline-flex h-12 items-center border border-black/10 px-6 text-[13px] font-semibold text-foreground transition hover:border-black/20"
                    >
                      Connect email accounts
                    </a>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <div className="grid min-h-0 flex-1 overflow-hidden gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <InboxThreadList
                filteredThreads={filteredThreads}
                activeThreadId={activeThreadId}
                threadPreviewStates={threadPreviewStates}
                query={query}
                onQueryChange={setQuery}
                activeFilterCount={activeFilterCount}
                sortLabel={inboxSortLabel(selectedFilters.sort)}
                onOpenFilters={() => setIsFilterDialogOpen(true)}
                onOpenSort={() => setIsSortDialogOpen(true)}
                onLoadThread={(threadId) => void loadThread(threadId)}
                onPrefetchThread={(threadId) => void prefetchThread(threadId)}
                onPrefetchThreadSuggestions={(thread) => void prefetchThreadSuggestions(thread)}
                mobileDetailOpen={mobileDetailOpen}
              />

              {!selectedThread ? (
                <section
                  className={`flex min-h-0 flex-col overflow-hidden border border-black/8 bg-white xl:mr-28 dark:border-white/10 dark:bg-white/[0.03] ${!mobileDetailOpen ? "hidden xl:flex" : ""}`}
                >
                  <div className="px-6 py-10 text-[13px] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setMobileDetailOpen(false)}
                      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground xl:hidden"
                    >
                      {"<"} Back to threads
                    </button>
                    <p>Select a thread to see the full conversation.</p>
                  </div>
                </section>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <InboxThreadDetail
                    selectedThread={selectedThread}
                    isThreadLoading={isThreadLoading}
                    mobileDetailOpen={mobileDetailOpen}
                    onMobileBack={() => setMobileDetailOpen(false)}
                    isActionMenuOpen={isActionMenuOpen}
                    onToggleActionMenu={() => setIsActionMenuOpen((c) => !c)}
                    onSummarizeThread={() => void summarizeThread()}
                    isSummarizing={isSummarizing}
                    hasThreadSummary={hasThreadSummary}
                    onViewSummary={() => setSummaryDialogOpen(true)}
                    replyStance={replyStance}
                    onSetReplyStance={setReplyStance}
                    onOpenNotes={() => setIsNotesDialogOpen(true)}
                    onOpenLinkModal={() => setLinkModalOpen(true)}
                    isUpdatingWorkflow={isUpdatingWorkflow}
                    onUpdateWorkflowState={(state) =>
                      void updateWorkflowState(
                        state as import("@/lib/types").EmailThreadWorkflowState
                      )
                    }
                    areActionItemsOpen={areActionItemsOpen}
                    onActionItemsOpenChange={handleActionItemsOpenChange}
                    hasUnseenActionItems={hasUnseenActionItems}
                    latestActionItemAt={latestActionItemAt}
                    onGenerateReplyFromActionItem={(item) => void generateReplyFromActionItem(item)}
                    isDrafting={isDrafting}
                    currentCopilotInsights={currentCopilotInsights}
                    earlierMessages={earlierMessages}
                    latestMessage={latestMessage}
                    onPrefetchThread={(threadId) => void prefetchThread(threadId)}
                  />

                  <ThreadAttachments
                    messages={selectedMessages}
                    primaryLinkId={selectedThread?.primaryLink?.dealId || null}
                    importingAttachmentId={importingAttachmentId}
                    onImportAttachment={(id) => void importAttachmentToWorkspace(id)}
                  />

                  <InboxReplyComposer
                    replyBody={replyBody}
                    replyBodyRef={replyBodyRef}
                    replyJourney={replyJourney}
                    isDrafting={isDrafting}
                    shouldHighlightAiReply={shouldHighlightAiReply}
                    canRefineGeneratedReply={canRefineGeneratedReply}
                    canClearReplyText={canClearReplyText}
                    canSendReply={canSendReply}
                    isSavingDraft={isSavingDraft}
                    isSendingReply={isSendingReply}
                    replySignatureMissingFields={replySignatureMissingFields}
                    isReplySignatureBannerVisible={isReplySignatureBannerVisible}
                    replySignatureBannerStateKey={replySignatureBannerStateKey}
                    isInvoiceAttached={isInvoiceAttached}
                    canAttachInvoice={canAttachInvoice}
                    selectedThreadInvoiceAttachment={selectedThreadInvoiceAttachment}
                    aiReplyControlRef={aiReplyControlRef}
                    aiReplyMenuWidth={aiReplyMenuWidth}
                    promptActionControlRef={promptActionControlRef}
                    promptActionMenuWidth={promptActionMenuWidth}
                    openRefinementPopover={openRefinementPopover}
                    draftInstructions={draftInstructions}
                    trimmedDraftInstructions={trimmedDraftInstructions}
                    isPromptCommandOpen={isPromptCommandOpen}
                    isLoadingSuggestions={isLoadingSuggestions}
                    promptSuggestions={promptSuggestions}
                    onReplyBodyChange={handleReplyBodyChange}
                    onDraftReply={() => void draftReply()}
                    onCancelDraftReply={cancelDraftReply}
                    onClearDraftComposer={clearDraftComposer}
                    onRefineGeneratedDraft={(instruction) => void refineGeneratedDraft(instruction)}
                    onSaveDraft={(status) => void saveDraft(status as "in_progress" | "ready")}
                    onSendReply={() => void sendReply()}
                    onSetInvoiceAttached={(v) => setIsInvoiceAttached(v)}
                    onSetOpenRefinementPopover={setOpenRefinementPopover}
                    onSetPromptCommandOpen={setPromptCommandOpen}
                    onSetDraftInstructions={setDraftInstructions}
                    onApplyPromptToNextDraft={applyPromptToNextDraft}
                    onClearPromptDialog={clearPromptDialog}
                    onRunPromptForDraft={() => void runPromptForDraft()}
                    onDismissSignatureBanner={() => {
                      window.localStorage.setItem(
                        INBOX_SIGNATURE_BANNER_DISMISS_KEY,
                        replySignatureBannerStateKey
                      );
                      setIsReplySignatureBannerVisible(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isSummaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Summary</DialogTitle>
            <DialogDescription>Thread summary for this partnership conversation.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <p className="whitespace-pre-wrap text-[13px] leading-7 text-foreground">
              {summary ?? "No summary available yet."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {isCandidateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden border border-black/8 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-black/8 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Deal matches found</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Select threads to link to your partnerships.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCandidateModal}
                className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {candidateGroups.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No matches yet. We&apos;ll keep scanning as more mail syncs.
                  </p>
                  <button
                    type="button"
                    onClick={closeCandidateModal}
                    className="mt-4 h-10 border border-black/10 px-5 text-sm font-medium text-foreground transition hover:border-black/20"
                  >
                    Keep checking
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {candidateGroups.map((group) => {
                    const labels = getDisplayDealLabels(group.deal);

                    return (
                      <section key={group.deal.id} className="border border-black/8">
                        <div className="flex items-baseline justify-between border-b border-black/8 px-4 py-3">
                          <p className="text-sm font-semibold text-foreground">
                            {labels.campaignName ?? group.deal.campaignName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {labels.brandName ?? group.deal.brandName}
                          </p>
                        </div>

                        <div className="divide-y divide-black/6">
                          {group.matches.map((match) => {
                            const isSelected = selectedCandidateIds.includes(match.candidate.id);
                            const isPrimary = primaryCandidateId === match.candidate.id;

                            return (
                              <div
                                key={match.candidate.id}
                                className="flex items-start gap-3 px-4 py-3"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCandidate(match.candidate.id)}
                                  className="mt-0.5 h-4 w-4 border border-border"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[13px] font-medium text-foreground">
                                      {match.thread.subject}
                                    </p>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                      {Math.round(match.candidate.confidence * 100)}%
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {providerLabel(match.account.provider)} ·{" "}
                                    {match.account.emailAddress}
                                  </p>
                                  {match.thread.snippet ? (
                                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground/70">
                                      {match.thread.snippet}
                                    </p>
                                  ) : null}
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => choosePrimaryCandidate(match.candidate.id)}
                                      className={`px-2.5 py-1 text-[10px] font-medium transition ${
                                        isPrimary
                                          ? "bg-[#eff6ff] text-[#1d4ed8]"
                                          : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
                                      }`}
                                    >
                                      {isPrimary ? "Primary workspace" : "Set as primary"}
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void dismissCandidate(match.candidate.id)}
                                  disabled={isReviewingCandidates}
                                  className="shrink-0 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                                >
                                  Dismiss
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/8 px-6 py-3">
              <button
                type="button"
                onClick={() => void reviewCandidates("reject_all")}
                disabled={candidateGroups.length === 0 || isReviewingCandidates}
                className="h-9 px-4 text-[13px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-60"
              >
                Dismiss all
              </button>
              <button
                type="button"
                onClick={closeCandidateModal}
                className="h-9 border border-black/10 px-4 text-[13px] font-medium text-foreground transition hover:border-black/20"
              >
                Keep checking
              </button>
              <button
                type="button"
                onClick={() => void reviewCandidates("confirm")}
                disabled={selectedCandidateIds.length === 0 || isReviewingCandidates}
                className="h-9 bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isReviewingCandidates
                  ? "Linking..."
                  : `Link ${selectedCandidateIds.length > 0 ? selectedCandidateIds.length : ""} selected`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <InboxFilterDialog
        open={isFilterDialogOpen}
        onOpenChange={setIsFilterDialogOpen}
        draftProviderFilter={draftProviderFilter}
        setDraftProviderFilter={setDraftProviderFilter}
        draftDealFilter={draftDealFilter}
        setDraftDealFilter={setDraftDealFilter}
        draftWorkflowFilter={draftWorkflowFilter}
        setDraftWorkflowFilter={setDraftWorkflowFilter}
        connectedProviders={connectedProviders}
        deals={deals}
        onClear={clearDialogFilters}
        onApply={applyDialogFilters}
      />

      <InboxSortDialog
        open={isSortDialogOpen}
        onOpenChange={setIsSortDialogOpen}
        draftSort={draftSort}
        setDraftSort={setDraftSort}
        onApply={applyDialogSort}
      />

      {isDiscovering ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm border border-black/8 bg-white px-6 py-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-foreground" />
                <p className="text-[14px] font-medium text-foreground">Fetching recent emails...</p>
              </div>
              <button
                type="button"
                onClick={cancelDiscovery}
                className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition hover:text-foreground"
                aria-label="Cancel email discovery"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedThread && isLinkModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm border border-black/8 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#161a20]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Link partnership
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">Pick a workspace</h3>
              </div>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center border border-black/10 text-foreground transition hover:border-black/20"
                aria-label="Close link partnership modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Choose a primary workspace owner or add a reference workspace for this thread.
            </p>

            <div className="mt-5 space-y-4">
              <InboxSelect
                value={selectedDealId}
                onChange={(value) => {
                  setSelectedDealId(value);
                  const existingLink = selectedThread.links.find((link) => link.dealId === value);
                  setSelectedLinkRole(existingLink?.role === "reference" ? "reference" : "primary");
                }}
              >
                <option value="">Select a workspace</option>
                {linkableDeals.map((deal) => {
                  const labels = getDisplayDealLabels(deal);

                  return (
                    <option key={deal.id} value={deal.id}>
                      {labels.campaignName ?? deal.campaignName}
                    </option>
                  );
                })}
              </InboxSelect>

              <InboxSelect
                value={selectedLinkRole}
                onChange={(value) =>
                  setSelectedLinkRole(value === "reference" ? "reference" : "primary")
                }
              >
                <option value="primary">Primary workspace</option>
                <option value="reference">Reference workspace</option>
              </InboxSelect>

              {linkableDeals.length === 0 ? (
                <p className="text-[12px] leading-5 text-muted-foreground">
                  No active workspaces are available to link right now.
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void linkSelectedDeal()}
                  disabled={!selectedDealId || isLinking || linkableDeals.length === 0}
                  className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isLinking
                    ? "Updating..."
                    : linkedDealIds.has(selectedDealId)
                      ? "Unlink workspace"
                      : selectedLinkRole === "primary"
                        ? "Set primary workspace"
                        : "Add reference"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <InboxPrivateNotesDialog
        open={Boolean(selectedThread && isNotesDialogOpen)}
        onOpenChange={setIsNotesDialogOpen}
        selectedThread={selectedThread}
        noteBody={noteBody}
        setNoteBody={setNoteBody}
        isSavingNote={isSavingNote}
        onSave={() => {
          void savePrivateNote();
        }}
      />

      <Dialog
        open={isManualAddModalOpen}
        onOpenChange={(open) => {
          if (open) {
            openManualAddModal();
          } else {
            closeManualAddModal();
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[920px] flex-col overflow-hidden rounded-none p-0 sm:max-w-[920px] [&>button]:rounded-none">
          <DialogHeader className="shrink-0 gap-3 border-b border-black/8 px-6 py-5 pr-12">
            <DialogTitle>Add threads manually</DialogTitle>
            <DialogDescription className="line-clamp-2">
              Browse the latest 20 synced emails by default. Search scans up to the first 1000
              synced emails and lets you link the threads you want to a workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <InboxSelect
                value={manualAddDealId}
                onChange={setManualAddDealId}
                className="w-full shrink-0 sm:w-[240px]"
              >
                <option value="">Select a workspace</option>
                {linkableDeals.map((deal) => {
                  const labels = getDisplayDealLabels(deal);

                  return (
                    <option key={deal.id} value={deal.id}>
                      {labels.campaignName ?? deal.campaignName}
                    </option>
                  );
                })}
              </InboxSelect>

              <InboxSelect
                value={manualAddProviderFilter}
                onChange={setManualAddProviderFilter}
                className="w-full shrink-0 sm:w-[140px]"
              >
                <option value="">All providers</option>
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="yahoo">Yahoo</option>
              </InboxSelect>

              <Input
                value={manualAddQuery}
                onChange={(event) => setManualAddQuery(event.currentTarget.value)}
                placeholder="Search synced emails"
                aria-label="Search synced emails"
                className="h-9 min-w-0 flex-1 rounded-none border-black/10 bg-white text-[12px] shadow-none"
              />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-black/8 rounded-none">
              <div className="flex shrink-0 items-center justify-between border-b border-black/8 px-4 py-3 text-[12px] text-muted-foreground">
                <span>
                  {manualAddQuery.trim()
                    ? `Search results from up to 1000 synced emails`
                    : "Latest 20 synced emails"}
                </span>
                <span>
                  {manualAddProviderFilter
                    ? manualAddThreads.filter(
                        (item) => item.account.provider === manualAddProviderFilter
                      ).length
                    : manualAddThreads.length}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {isManualAddLoading ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">Loading emails...</div>
                ) : manualAddThreads.filter(
                    (item) =>
                      !manualAddProviderFilter || item.account.provider === manualAddProviderFilter
                  ).length === 0 ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">
                    No synced emails match this search.
                  </div>
                ) : (
                  manualAddThreads
                    .filter(
                      (item) =>
                        !manualAddProviderFilter ||
                        item.account.provider === manualAddProviderFilter
                    )
                    .map((item) => {
                      const alreadyLinkedToSelectedDeal = Boolean(
                        manualAddDealId &&
                          item.links.some((link) => link.dealId === manualAddDealId)
                      );

                      return (
                        <label
                          key={item.thread.id}
                          className="flex cursor-pointer items-start gap-3 border-b border-black/6 px-4 py-3 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedManualThreadIdSet.has(item.thread.id)}
                            disabled={alreadyLinkedToSelectedDeal}
                            onChange={() => toggleManualAddThread(item.thread.id)}
                            className="mt-1 h-4 w-4 rounded border-border"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-foreground">
                                  {item.thread.participants[0]?.name?.trim() ||
                                    item.thread.participants[0]?.email ||
                                    "Unknown"}
                                </p>
                                <p className="truncate text-[12px] text-foreground/90">
                                  {item.thread.subject}
                                </p>
                              </div>
                              <p className="shrink-0 text-[11px] text-muted-foreground">
                                {new Date(item.thread.lastMessageAt).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                              {item.thread.snippet || "No preview available."}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="bg-white px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                                {providerLabel(item.account.provider)}
                              </span>
                              {alreadyLinkedToSelectedDeal ? (
                                <span className="bg-secondary/60 px-2.5 py-1 text-[10px] font-medium text-foreground">
                                  Already linked
                                </span>
                              ) : null}
                              {item.links.length > 0 ? (
                                <span className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                                  {item.links.length} workspace{item.links.length === 1 ? "" : "s"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-4 border-t border-black/8 pt-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <p className="text-[12px] text-muted-foreground">
                  {manualAddSelectedThreadIds.length} thread
                  {manualAddSelectedThreadIds.length === 1 ? "" : "s"} selected
                </p>
                {selectedManualThreads.length > 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    Create a new workspace from {selectedManualThreads.length} selected thread
                    {selectedManualThreads.length === 1 ? "" : "s"}.
                  </p>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-end">
                <button
                  type="button"
                  onClick={() => closeManualAddModal()}
                  className={`${THREAD_ACTION_BUTTON_CLASS} w-full min-w-[8.75rem] md:w-auto`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void createWorkspaceFromSelectedThreads()}
                  disabled={
                    selectedManualThreads.length === 0 ||
                    isManualAddSubmitting ||
                    isManualAddCreatingWorkspace
                  }
                  className={`${THREAD_ACTION_BUTTON_CLASS} w-full min-w-[8.75rem] md:w-auto`}
                >
                  {isManualAddCreatingWorkspace ? "Creating..." : "Create workspace"}
                </button>
                <button
                  type="button"
                  onClick={() => void submitManualAddThreads()}
                  disabled={
                    !manualAddDealId ||
                    manualAddSelectedThreadIds.length === 0 ||
                    isManualAddSubmitting ||
                    isManualAddCreatingWorkspace
                  }
                  className={`${THREAD_ACTION_BUTTON_CLASS} w-full min-w-[9.75rem] md:w-auto`}
                >
                  {isManualAddSubmitting ? "Adding..." : "Add selected threads"}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
