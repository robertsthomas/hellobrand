"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { DealRecord, EmailThreadListItem } from "@/lib/types";
import { inferWorkspaceDraftFromThread } from "./inbox-workspace/helpers";

type UseInboxManualAddOptions = {
  deals: DealRecord[];
  onErrorMessage: (value: string | null) => void;
  selectedFilterDealId: string;
};

export function useInboxManualAdd({
  deals,
  onErrorMessage,
  selectedFilterDealId,
}: UseInboxManualAddOptions) {
  const router = useRouter();
  const manualAddSyncedRef = useRef(false);

  const linkableDeals = useMemo(
    () => deals.filter((deal) => deal.status !== "completed" && deal.status !== "paid"),
    [deals]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [dealId, setDealId] = useState(selectedFilterDealId);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [threads, setThreads] = useState<EmailThreadListItem[]>([]);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  // Pre-select deal when modal opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (selectedFilterDealId) {
      setDealId(selectedFilterDealId);
      return;
    }

    setDealId((current) => current || linkableDeals[0]?.id || "");
  }, [isOpen, linkableDeals, selectedFilterDealId]);

  // Deselect threads that are already linked when deal changes
  useEffect(() => {
    if (!dealId) {
      return;
    }

    setSelectedThreadIds((current) =>
      current.filter((threadId) => {
        const thread = threads.find((entry) => entry.thread.id === threadId);
        return !thread?.links.some((link) => link.dealId === dealId);
      })
    );
  }, [dealId, threads]);

  const fetchThreads = useCallback(
// fallow-ignore-next-line complexity
    async (nextQuery: string) => {
      if (!isOpen) {
        return;
      }

      setIsLoading(true);
      onErrorMessage(null);

      try {
        if (!manualAddSyncedRef.current) {
          manualAddSyncedRef.current = true;
          try {
            const syncRes = await fetch("/api/email/sync?force=1", { method: "POST" });
            if (!syncRes.ok) {
              const syncPayload = await syncRes.json().catch(() => null);
              const syncMsg = syncPayload?.error ?? "Could not sync latest emails.";
              onErrorMessage(typeof syncMsg === "string" ? syncMsg : String(syncMsg));
            }
          } catch {
            onErrorMessage("Could not sync latest emails. Please try again.");
          }
        }

        const params = new URLSearchParams();
        const trimmed = nextQuery.trim();
        if (trimmed) {
          params.set("q", trimmed);
          params.set("limit", "1000");
        } else {
          params.set("limit", "20");
        }

        const response = await fetch(`/api/email/threads?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load inbox threads.");
        }

        const nextThreads = (payload.threads ?? []) as EmailThreadListItem[];
        setThreads(nextThreads);
        setSelectedThreadIds((current) =>
          current.filter((threadId) => nextThreads.some((thread) => thread.thread.id === threadId))
        );
      } catch (error) {
        onErrorMessage(error instanceof Error ? error.message : "Could not load inbox threads.");
      } finally {
        setIsLoading(false);
      }
    },
    [isOpen, onErrorMessage]
  );

  // Debounced fetch on query change
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        void fetchThreads(query);
      },
      query.trim() ? 250 : 0
    );

    return () => window.clearTimeout(timeoutId);
  }, [fetchThreads, isOpen, query]);

  const toggleThread = useCallback((threadId: string) => {
    setSelectedThreadIds((current) =>
      current.includes(threadId) ? current.filter((id) => id !== threadId) : [...current, threadId]
    );
  }, []);

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setProviderFilter("");
    setSelectedThreadIds([]);
    setThreads([]);
    manualAddSyncedRef.current = false;
  }, []);

  const selectedThreadIdSet = useMemo(() => new Set(selectedThreadIds), [selectedThreadIds]);

  const selectedThreads = useMemo(
    () =>
      selectedThreadIds
        .map((threadId) => threads.find((entry) => entry.thread.id === threadId) ?? null)
        .filter((entry): entry is EmailThreadListItem => entry !== null),
    [selectedThreadIds, threads]
  );

  const filteredThreads = useMemo(
    () =>
      providerFilter ? threads.filter((item) => item.account.provider === providerFilter) : threads,
    [providerFilter, threads]
  );

  const submit = useCallback(async () => {
    if (!dealId || selectedThreadIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    onErrorMessage(null);

    try {
      const threadIdsToLink = selectedThreadIds.filter((threadId) => {
        const thread = threads.find((entry) => entry.thread.id === threadId);
        return !thread?.links.some((link) => link.dealId === dealId);
      });

      if (threadIdsToLink.length === 0) {
        close();
        return;
      }

      const responses = await Promise.all(
        threadIdsToLink.map(async (threadId) => {
          const thread = threads.find((entry) => entry.thread.id === threadId);
          const response = await fetch(`/api/email/threads/${threadId}/link`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              dealId,
              role: thread?.primaryLink ? "reference" : "primary",
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Could not link email thread.");
          }

          return payload;
        })
      );

      if (responses.length > 0) {
        close();
        router.refresh();
      }
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not link email threads.");
    } finally {
      setIsSubmitting(false);
    }
  }, [close, dealId, onErrorMessage, router, selectedThreadIds, threads]);

  const createWorkspace = useCallback(async () => {
    const seedThread = selectedThreads[0];
    if (!seedThread) {
      return;
    }

    setIsCreatingWorkspace(true);
    onErrorMessage(null);

    try {
      const createResponse = await fetch("/api/p", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inferWorkspaceDraftFromThread(seedThread)),
      });
      const createPayload = await createResponse.json().catch(() => ({}));

      if (!createResponse.ok || !createPayload.deal?.id) {
        throw new Error(createPayload.error ?? "Could not create workspace.");
      }

      const nextDealId = createPayload.deal.id as string;
      const threadIdsToLink = selectedThreadIds.filter((threadId) => {
        const thread = threads.find((entry) => entry.thread.id === threadId);
        return !thread?.links.some((link) => link.dealId === nextDealId);
      });

      const responses = await Promise.all(
        threadIdsToLink.map(async (threadId) => {
          const thread = threads.find((entry) => entry.thread.id === threadId);
          const response = await fetch(`/api/email/threads/${threadId}/link`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              dealId: nextDealId,
              role: thread?.primaryLink ? "reference" : "primary",
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Could not link email thread.");
          }

          return payload;
        })
      );

      if (responses.length > 0 || threadIdsToLink.length === 0) {
        setDealId(nextDealId);
        close();
        router.refresh();
      }
    } catch (error) {
      onErrorMessage(error instanceof Error ? error.message : "Could not create workspace.");
    } finally {
      setIsCreatingWorkspace(false);
    }
  }, [close, onErrorMessage, router, selectedThreadIds, selectedThreads, threads]);

  return {
    // Modal open/close
    isOpen,
    open,
    close,
    // Form state
    dealId,
    setDealId,
    query,
    setQuery,
    providerFilter,
    setProviderFilter,
    // Thread data
    threads,
    filteredThreads,
    selectedThreadIdSet,
    selectedThreadIds,
    selectedThreads,
    toggleThread,
    // Async state
    isLoading,
    isSubmitting,
    isCreatingWorkspace,
    // Actions
    submit,
    createWorkspace,
    // Derived
    linkableDeals,
  };
}
