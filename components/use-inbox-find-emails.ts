"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { DealRecord, EmailThreadListItem } from "@/lib/types";
import { isLikelyBrandDealEmail } from "@/lib/email/smart-inbox";
import { inferWorkspaceDraftFromThread } from "./inbox-workspace/helpers";

type ThreadDealAssignment = Record<string, string>;
export const CREATE_NEW_WORKSPACE_VALUE = "__create_new_workspace__";

type UseInboxFindEmailsOptions = {
  deals: DealRecord[];
  onErrorMessage: (value: string | null) => void;
  onOpenManualAdd: () => void;
};

const FIND_EMAILS_CACHE_TTL = 60 * 1000;

export function useInboxFindEmails({
  deals,
  onErrorMessage,
  onOpenManualAdd,
}: UseInboxFindEmailsOptions) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<EmailThreadListItem[]>([]);
  const [assignments, setAssignments] = useState<ThreadDealAssignment>({});
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const scanRequestRef = useRef<AbortController | null>(null);
  const cachedResultsRef = useRef<EmailThreadListItem[]>([]);
  const cacheAtRef = useRef(0);

  const linkableDeals = useMemo(
    () => deals.filter((deal) => deal.status !== "completed" && deal.status !== "paid"),
    [deals]
  );

  useEffect(() => {
    return () => {
      scanRequestRef.current?.abort();
    };
  }, []);

  const scan = useCallback(async () => {
    if (cacheAtRef.current > 0 && Date.now() - cacheAtRef.current < FIND_EMAILS_CACHE_TTL) {
      const cachedResults = cachedResultsRef.current;
      const initialSelected = new Set<string>();
      for (const item of cachedResults) {
        initialSelected.add(item.thread.id);
      }

      onErrorMessage(null);
      setResults(cachedResults);
      setAssignments({});
      setSelectedThreadIds(initialSelected);
      setIsOpen(true);
      return;
    }

    scanRequestRef.current?.abort();
    const controller = new AbortController();
    scanRequestRef.current = controller;

    setIsScanning(true);
    onErrorMessage(null);
    setResults([]);
    setAssignments({});
    setSelectedThreadIds(new Set());

    try {
      const syncRes = await fetch("/api/email/sync?force=1", { method: "POST", signal: controller.signal });
      if (!syncRes.ok) {
        const syncPayload = await syncRes.json().catch(() => null);
        const syncMsg = syncPayload?.error ?? "Could not sync latest emails.";
        onErrorMessage(typeof syncMsg === "string" ? syncMsg : String(syncMsg));
      }

      const params = new URLSearchParams();
      params.set("limit", "1000");

      const response = await fetch(`/api/email/threads?${params.toString()}`, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load inbox threads.");
      }

      const allThreads = (payload.threads ?? []) as EmailThreadListItem[];
      const brandDealThreads = allThreads.filter(
        (item) => isLikelyBrandDealEmail(item) && item.links.length === 0
      );

      cachedResultsRef.current = brandDealThreads;
      cacheAtRef.current = Date.now();
      setResults(brandDealThreads);

      const initialAssignments: ThreadDealAssignment = {};
      const initialSelected = new Set<string>();
      for (const item of brandDealThreads) {
        initialSelected.add(item.thread.id);
      }
      setAssignments(initialAssignments);
      setSelectedThreadIds(initialSelected);
      setIsOpen(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      onErrorMessage(error instanceof Error ? error.message : "Could not scan inbox.");
    } finally {
      if (scanRequestRef.current === controller) {
        scanRequestRef.current = null;
      }
      setIsScanning(false);
    }
  }, [onErrorMessage]);

  const cancelScan = useCallback(() => {
    scanRequestRef.current?.abort();
    scanRequestRef.current = null;
    setIsScanning(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setResults([]);
    setAssignments({});
    setSelectedThreadIds(new Set());
  }, []);

  const toggleThread = useCallback((threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  const setAssignment = useCallback((threadId: string, dealId: string) => {
    setAssignments((prev) => ({ ...prev, [threadId]: dealId }));
  }, []);

  const submit = useCallback(async () => {
    const threadsToProcess = Array.from(selectedThreadIds)
      .map((threadId) => {
        const item = results.find((entry) => entry.thread.id === threadId) ?? null;
        return item ? { item, assignment: assignments[threadId] ?? "" } : null;
      })
      .filter((entry): entry is { item: EmailThreadListItem; assignment: string } => Boolean(entry));

    if (threadsToProcess.length === 0) {
      return;
    }

    setIsSubmitting(true);
    onErrorMessage(null);

    try {
      const responses = await Promise.all(
        threadsToProcess.map(async ({ item, assignment }) => {
          if (!assignment) {
            return null;
          }

          let dealId = assignment;
          if (assignment === CREATE_NEW_WORKSPACE_VALUE) {
            const createResponse = await fetch("/api/p", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(inferWorkspaceDraftFromThread(item)),
            });
            const createPayload = await createResponse.json().catch(() => ({}));

            if (!createResponse.ok || !createPayload.deal?.id) {
              throw new Error(createPayload.error ?? "Could not create workspace.");
            }

            dealId = createPayload.deal.id as string;
          }

          const response = await fetch(`/api/email/threads/${item.thread.id}/link`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ dealId, role: item.primaryLink ? "reference" : "primary" }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Could not link email thread.");
          }

          return payload;
        })
      );

      if (responses.some(Boolean)) {
        close();
        router.refresh();
      }
    } catch (error) {
      onErrorMessage(
        error instanceof Error ? error.message : "Could not add email threads to workspaces."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [assignments, close, onErrorMessage, results, router, selectedThreadIds]);

  const openManualAdd = useCallback(() => {
    close();
    onOpenManualAdd();
  }, [close, onOpenManualAdd]);

  const unassignedCount = useMemo(
    () =>
      Array.from(selectedThreadIds).filter(
        (threadId) => !assignments[threadId]
      ).length,
    [selectedThreadIds, assignments]
  );

  return {
    isOpen,
    isScanning,
    isSubmitting,
    results,
    assignments,
    selectedThreadIds,
    linkableDeals,
    unassignedCount,
    scan,
    cancelScan,
    close,
    toggleThread,
    setAssignment,
    submit,
    openManualAdd,
  };
}
