"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EmailThreadDetail, EmailThreadListItem } from "@/lib/types";

type UseInboxThreadSelectionOptions = {
  initialSelectedThread: EmailThreadDetail | null;
  onErrorMessage: (value: string | null) => void;
  threads: EmailThreadListItem[];
};

export function useInboxThreadSelection({
  initialSelectedThread,
  onErrorMessage,
  threads
}: UseInboxThreadSelectionOptions) {
  const threadCacheRef = useRef<Record<string, EmailThreadDetail>>({});
  const threadRequestRef = useRef<AbortController | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThreadDetail | null>(
    initialSelectedThread
  );
  const [activeThreadId, setActiveThreadId] = useState(
    initialSelectedThread?.thread.id ?? threads[0]?.thread.id ?? ""
  );
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const selectedThreadId = selectedThread?.thread.id ?? "";

  useEffect(() => {
    setSelectedThread(initialSelectedThread);
    setActiveThreadId(initialSelectedThread?.thread.id ?? threads[0]?.thread.id ?? "");

    if (initialSelectedThread) {
      threadCacheRef.current[initialSelectedThread.thread.id] = initialSelectedThread;
    }
  }, [initialSelectedThread, threads]);

  useEffect(() => {
    return () => {
      threadRequestRef.current?.abort();
    };
  }, []);

  const loadThread = useCallback(
    async (threadId: string) => {
      if (!threadId || threadId === selectedThreadId) {
        return;
      }

      setActiveThreadId(threadId);
      onErrorMessage(null);

      const cached = threadCacheRef.current[threadId];
      if (cached) {
        setSelectedThread(cached);
        return;
      }

      threadRequestRef.current?.abort();
      const controller = new AbortController();
      threadRequestRef.current = controller;

      setIsThreadLoading(true);
      try {
        const response = await fetch(`/api/email/threads/${threadId}`, {
          signal: controller.signal
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load email thread.");
        }

        const detail = payload.thread as EmailThreadDetail;
        threadCacheRef.current[threadId] = detail;
        setSelectedThread(detail);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        onErrorMessage(
          error instanceof Error ? error.message : "Could not load email thread."
        );
      } finally {
        if (threadRequestRef.current === controller) {
          threadRequestRef.current = null;
        }
        setIsThreadLoading(false);
      }
    },
    [onErrorMessage, selectedThreadId]
  );

  const prefetchThread = useCallback(async (threadId: string) => {
    if (!threadId || threadCacheRef.current[threadId]) {
      return;
    }

    try {
      const response = await fetch(`/api/email/threads/${threadId}`);
      const payload = await response.json();
      if (!response.ok || !payload.thread) {
        return;
      }

      threadCacheRef.current[threadId] = payload.thread as EmailThreadDetail;
    } catch {
      // Ignore prefetch failures. Selection will fall back to the normal fetch path.
    }
  }, []);

  return {
    activeThreadId,
    isThreadLoading,
    loadThread,
    prefetchThread,
    selectedThread,
    selectedThreadId
  };
}
