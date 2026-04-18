/**
 * Left panel: thread list with search, filters, and sort controls.
 * Receives pre-computed data and callbacks from the parent orchestrator.
 */
"use client";

import {
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import type { EmailThreadListItem, EmailThreadPreviewStateRecord } from "@/lib/types";
import {
  providerLabel,
  workflowStateLabel,
  workflowBadgeClass,
  initialsFromParticipant,
  participantLabel,
} from "./formatters";
import {
  hasUnseenPreviewSection,
} from "./helpers";

type InboxThreadListProps = {
  filteredThreads: EmailThreadListItem[];
  activeThreadId: string | null;
  threadPreviewStates: Record<string, EmailThreadPreviewStateRecord>;
  query: string;
  onQueryChange: (value: string) => void;
  activeFilterCount: number;
  sortLabel: string;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onLoadThread: (threadId: string) => void;
  onPrefetchThread: (threadId: string) => void;
  onPrefetchThreadSuggestions: (thread: EmailThreadListItem["thread"]) => void;
  mobileDetailOpen: boolean;
};

export function InboxThreadList({
  filteredThreads,
  activeThreadId,
  threadPreviewStates,
  query,
  onQueryChange,
  activeFilterCount,
  sortLabel,
  onOpenFilters,
  onOpenSort,
  onLoadThread,
  onPrefetchThread,
  onPrefetchThreadSuggestions,
  mobileDetailOpen,
}: InboxThreadListProps) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden border border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03] ${
        mobileDetailOpen ? "hidden xl:flex" : ""
      }`}
    >
      <div className="shrink-0 border-b border-black/8 px-5 py-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-wrap gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenFilters}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:flex-none"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount > 0 ? (
                <span className="border border-black/10 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={onOpenSort}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:flex-none"
            >
              <ArrowUpDown className="h-4 w-4" />
              <span>{sortLabel}</span>
            </button>
          </div>
          <span className="shrink-0 bg-secondary/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            {filteredThreads.length}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-transparent">
        {filteredThreads.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            No inbox threads match your search.
          </div>
        ) : (
// fallow-ignore-next-line complexity
          filteredThreads.map((item) => {
            const active = item.thread.id === activeThreadId;
            const itemPreviewState = threadPreviewStates[item.thread.id];
            const threadHasUnseenActionItems =
              item.pendingActionItemCount > 0 &&
              hasUnseenPreviewSection(
                item.latestPendingActionItemAt,
                itemPreviewState?.actionItemsSeenAt
              );

            return (
              <button
                key={item.thread.id}
                type="button"
                onClick={() => {
                  onPrefetchThreadSuggestions(item.thread);
                  onLoadThread(item.thread.id);
                }}
                onMouseEnter={() => onPrefetchThread(item.thread.id)}
                onFocus={() => onPrefetchThread(item.thread.id)}
                className={`block w-full border-b border-black/6 px-4 py-3 text-left transition dark:border-white/8 ${
                  active ? "bg-secondary/30" : "hover:bg-secondary/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-secondary/50 text-sm font-semibold text-foreground">
                    {initialsFromParticipant(item.thread.participants[0])}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold leading-5 text-foreground">
                          {participantLabel(item.thread.participants[0])}
                        </p>
                        <p className="truncate text-[12px] text-foreground/90">
                          {item.thread.subject}
                        </p>
                      </div>
                      <p className="shrink-0 text-right text-[11px] text-muted-foreground">
                        {item.thread.lastMessageAt ? new Date(item.thread.lastMessageAt).toLocaleDateString() : ""}
                      </p>
                    </div>

                    <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                      {item.thread.snippet || "No preview available."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="bg-white px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                        {providerLabel(item.account.provider)}
                      </span>
                      <span
                        className={`px-2.5 py-1 text-[10px] font-medium ${workflowBadgeClass(
                          item.thread.workflowState
                        )}`}
                      >
                        {workflowStateLabel(item.thread.workflowState)}
                      </span>
                      {item.savedDraft ? (
                        <span className="bg-[#ecfdf3] px-2.5 py-1 text-[10px] font-medium text-[#047857]">
                          {item.savedDraft.status === "ready"
                            ? "Draft ready"
                            : "Draft saved"}
                        </span>
                      ) : null}
                      {item.noteCount > 0 ? (
                        <span className="bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                          {item.noteCount} note{item.noteCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {item.pendingActionItemCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 bg-[#fef3f2] px-2.5 py-1 text-[10px] font-medium text-[#b42318]">
                          {threadHasUnseenActionItems ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#b42318]" />
                          ) : null}
                          {item.pendingActionItemCount} action
                          {item.pendingActionItemCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
