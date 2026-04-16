"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildReplySuggestionThreadVersion } from "@/lib/email/reply-suggestion-version";
import type { EmailThreadDetail } from "@/lib/types";
import {
  type DraftPromptSuggestion,
  type DraftPromptSuggestionCacheEntry,
  type DocumentSuggestion,
  type RiskSuggestion,
  DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY,
  loadDraftPromptSuggestionCache,
} from "./inbox-workspace/helpers";

type UseInboxAiSuggestionsOptions = {
  selectedThread: EmailThreadDetail | null;
  selectedThreadSuggestionVersion: string | null;
  isPromptCommandOpen: boolean;
};

export function useInboxAiSuggestions({
  selectedThread,
  selectedThreadSuggestionVersion,
  isPromptCommandOpen,
}: UseInboxAiSuggestionsOptions) {
  const [suggestionCache, setSuggestionCache] = useState<
    Record<string, DraftPromptSuggestionCacheEntry>
  >(loadDraftPromptSuggestionCache);
  const suggestionCacheRef = useRef(suggestionCache);
  const [copilotInsightCache, setCopilotInsightCache] = useState<
    Record<string, { risks: RiskSuggestion[]; documents: DocumentSuggestion[] }>
  >({});
  const [loadingThreadIds, setLoadingThreadIds] = useState<Record<string, true>>({});
  const requestVersionsRef = useRef<Record<string, string>>({});

  // Mirror cache to ref and sessionStorage on change
  useEffect(() => {
    suggestionCacheRef.current = suggestionCache;

    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      DRAFT_PROMPT_SUGGESTIONS_CACHE_KEY,
      JSON.stringify(suggestionCache)
    );
  }, [suggestionCache]);

  // Evict stale cache entries when selected thread version changes
  useEffect(() => {
    if (!selectedThread || !selectedThreadSuggestionVersion) {
      return;
    }

    const cached = suggestionCacheRef.current[selectedThread.thread.id];
    if (!cached || cached.version === selectedThreadSuggestionVersion) {
      return;
    }

    setSuggestionCache((current) => {
      const existing = current[selectedThread.thread.id];
      if (!existing || existing.version === selectedThreadSuggestionVersion) {
        return current;
      }

      const next = { ...current };
      delete next[selectedThread.thread.id];
      return next;
    });
  }, [selectedThread, selectedThreadSuggestionVersion]);

  const prefetch = useCallback(
    async (
      thread: Pick<
        EmailThreadDetail["thread"],
        "id" | "updatedAt" | "lastMessageAt" | "messageCount"
      >
    ) => {
      const version = buildReplySuggestionThreadVersion(thread);
      const cached = suggestionCacheRef.current[thread.id];

      if (cached?.version === version && cached.suggestions.length > 0) {
        return;
      }

      if (requestVersionsRef.current[thread.id] === version) {
        return;
      }

      requestVersionsRef.current[thread.id] = version;
      setLoadingThreadIds((current) => ({ ...current, [thread.id]: true }));

      try {
        const response = await fetch(`/api/email/threads/${thread.id}/suggestions`);
        const payload = await response.json();

        if (!response.ok || !Array.isArray(payload.suggestions)) {
          return;
        }

        setSuggestionCache((current) => {
          const existing = current[thread.id];
          if (existing?.version === version && existing.suggestions.length > 0) {
            return current;
          }

          return {
            ...current,
            [thread.id]: {
              version,
              suggestions: payload.suggestions as DraftPromptSuggestion[],
            },
          };
        });

        setCopilotInsightCache((current) => ({
          ...current,
          [thread.id]: {
            risks: Array.isArray(payload.riskSuggestions)
              ? (payload.riskSuggestions as RiskSuggestion[])
              : [],
            documents: Array.isArray(payload.documentSuggestions)
              ? (payload.documentSuggestions as DocumentSuggestion[])
              : [],
          },
        }));
      } catch {
        // Keep fallback suggestions when prefetch fails.
      } finally {
        if (requestVersionsRef.current[thread.id] === version) {
          delete requestVersionsRef.current[thread.id];
        }

        setLoadingThreadIds((current) => {
          if (!current[thread.id]) {
            return current;
          }

          const next = { ...current };
          delete next[thread.id];
          return next;
        });
      }
    },
    []
  );

  // Auto-prefetch when selected thread changes (2s delay)
  useEffect(() => {
    if (!selectedThread) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void prefetch(selectedThread.thread);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [
    prefetch,
    selectedThread?.thread.id,
    selectedThread?.thread.updatedAt,
    selectedThread?.thread.lastMessageAt,
    selectedThread?.thread.messageCount,
  ]);

  // Eagerly prefetch when prompt command opens
  useEffect(() => {
    if (!isPromptCommandOpen || !selectedThread) {
      return;
    }

    void prefetch(selectedThread.thread);
  }, [isPromptCommandOpen, prefetch, selectedThread]);

  const currentSuggestions = useMemo(() => {
    if (!selectedThread || !selectedThreadSuggestionVersion) {
      return [] as DraftPromptSuggestion[];
    }

    const cached = suggestionCache[selectedThread.thread.id];
    if (!cached || cached.version !== selectedThreadSuggestionVersion) {
      return [] as DraftPromptSuggestion[];
    }

    return cached.suggestions;
  }, [suggestionCache, selectedThread, selectedThreadSuggestionVersion]);

  const currentCopilotInsights = useMemo(() => {
    if (!selectedThread) {
      return { risks: [] as RiskSuggestion[], documents: [] as DocumentSuggestion[] };
    }

    return (
      copilotInsightCache[selectedThread.thread.id] ?? {
        risks: [] as RiskSuggestion[],
        documents: [] as DocumentSuggestion[],
      }
    );
  }, [copilotInsightCache, selectedThread]);

  const isLoading = Boolean(selectedThread && loadingThreadIds[selectedThread.thread.id]);

  return {
    prefetch,
    currentSuggestions,
    currentCopilotInsights,
    isLoading,
  };
}
