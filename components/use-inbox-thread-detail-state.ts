"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  EmailThreadDetail,
  EmailThreadPreviewStateRecord,
  EmailThreadWorkflowState
} from "@/lib/types";

type PreviewSection = "updates" | "actionItems";

type UseInboxThreadDetailStateOptions = {
  initialSelectedThread: EmailThreadDetail | null;
  initialThreadPreviewStates: Record<string, EmailThreadPreviewStateRecord>;
  linkedDealIds: Set<string>;
  onErrorMessage: (value: string | null) => void;
  onRefresh: () => void;
  selectedThread: EmailThreadDetail | null;
  selectedThreadId: string;
};

export function useInboxThreadDetailState({
  initialSelectedThread,
  initialThreadPreviewStates,
  linkedDealIds,
  onErrorMessage,
  onRefresh,
  selectedThread,
  selectedThreadId
}: UseInboxThreadDetailStateOptions) {
  const [selectedDealId, setSelectedDealId] = useState<string>(
    initialSelectedThread?.primaryLink?.dealId ?? ""
  );
  const [selectedLinkRole, setSelectedLinkRole] = useState<"primary" | "reference">(
    "primary"
  );
  const [summary, setSummary] = useState<string | null>(
    initialSelectedThread?.thread.aiSummary ?? null
  );
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isUpdatingWorkflow, setIsUpdatingWorkflow] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [arePreviewUpdatesOpen, setArePreviewUpdatesOpen] = useState(false);
  const [areActionItemsOpen, setAreActionItemsOpen] = useState(false);
  const [threadPreviewStates, setThreadPreviewStates] = useState(
    initialThreadPreviewStates
  );

  useEffect(() => {
    setThreadPreviewStates(initialThreadPreviewStates);
  }, [initialThreadPreviewStates]);

  useEffect(() => {
    setSummary(selectedThread?.thread.aiSummary ?? null);
    setIsSummaryDialogOpen(false);
    setSelectedDealId(selectedThread?.primaryLink?.dealId ?? "");
    setSelectedLinkRole("primary");
    setIsLinkModalOpen(false);
    setArePreviewUpdatesOpen(false);
    setAreActionItemsOpen(false);
  }, [selectedThread]);

  const markPreviewSectionSeen = useCallback(
    async (section: PreviewSection, seenAt: string | null) => {
      if (!selectedThreadId || !seenAt) {
        return;
      }

      setThreadPreviewStates((current) => {
        const existing = current[selectedThreadId];
        const nextState: EmailThreadPreviewStateRecord = {
          threadId: selectedThreadId,
          previewUpdatesSeenAt:
            section === "updates" ? seenAt : existing?.previewUpdatesSeenAt ?? null,
          previewUpdatesClearedAt: existing?.previewUpdatesClearedAt ?? null,
          actionItemsSeenAt:
            section === "actionItems" ? seenAt : existing?.actionItemsSeenAt ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return {
          ...current,
          [selectedThreadId]: nextState
        };
      });

      try {
        await fetch(`/api/email/threads/${selectedThreadId}/preview-state`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            section,
            action: "seen",
            timestamp: seenAt
          })
        });
      } catch {
        // Keep the optimistic state; this marker is UI-only.
      }
    },
    [selectedThreadId]
  );

  const clearPreviewUpdates = useCallback(
    async (latestPreviewUpdateAt: string | null) => {
      if (!selectedThreadId || !latestPreviewUpdateAt) {
        return;
      }

      const timestamp = latestPreviewUpdateAt;

      setThreadPreviewStates((current) => {
        const existing = current[selectedThreadId];
        const nextState: EmailThreadPreviewStateRecord = {
          threadId: selectedThreadId,
          previewUpdatesSeenAt: timestamp,
          previewUpdatesClearedAt: timestamp,
          actionItemsSeenAt: existing?.actionItemsSeenAt ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return {
          ...current,
          [selectedThreadId]: nextState
        };
      });
      setArePreviewUpdatesOpen(false);

      try {
        await fetch(`/api/email/threads/${selectedThreadId}/preview-state`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            section: "updates",
            action: "clear",
            timestamp
          })
        });
      } catch {
        // Keep the optimistic state; this marker is UI-only.
      }
    },
    [selectedThreadId]
  );

  const handlePreviewUpdatesOpenChange = useCallback(
    (
      open: boolean,
      hasUnseenPreviewUpdates: boolean,
      latestPreviewUpdateAt: string | null
    ) => {
      setArePreviewUpdatesOpen(open);
      if (open && hasUnseenPreviewUpdates) {
        void markPreviewSectionSeen("updates", latestPreviewUpdateAt);
      }
    },
    [markPreviewSectionSeen]
  );

  const handleActionItemsOpenChange = useCallback(
    (
      open: boolean,
      hasUnseenActionItems: boolean,
      latestActionItemAt: string | null
    ) => {
      setAreActionItemsOpen(open);
      if (open && hasUnseenActionItems) {
        void markPreviewSectionSeen("actionItems", latestActionItemAt);
      }
    },
    [markPreviewSectionSeen]
  );

  const summarizeThread = useCallback(async () => {
    if (!selectedThreadId) {
      return;
    }

    setIsSummarizing(true);
    onErrorMessage(null);
    try {
      const response = await fetch(`/api/email/threads/${selectedThreadId}/summarize`, {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not summarize email thread.");
      }
      setSummary(payload.summary ?? null);
      setIsSummaryDialogOpen(Boolean(payload.summary));
      onRefresh();
    } catch (error) {
      onErrorMessage(
        error instanceof Error ? error.message : "Could not summarize email thread."
      );
    } finally {
      setIsSummarizing(false);
    }
  }, [onErrorMessage, onRefresh, selectedThreadId]);

  const linkSelectedDeal = useCallback(async () => {
    if (!selectedThreadId || !selectedDealId) {
      return;
    }

    setIsLinking(true);
    onErrorMessage(null);
    try {
      const endpoint = linkedDealIds.has(selectedDealId) ? "unlink" : "link";
      const response = await fetch(`/api/email/threads/${selectedThreadId}/${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          dealId: selectedDealId,
          role: selectedLinkRole
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update deal link.");
      }
      setIsLinkModalOpen(false);
      onRefresh();
    } catch (error) {
      onErrorMessage(
        error instanceof Error ? error.message : "Could not update deal link."
      );
    } finally {
      setIsLinking(false);
    }
  }, [linkedDealIds, onErrorMessage, onRefresh, selectedDealId, selectedLinkRole, selectedThreadId]);

  const updateWorkflowState = useCallback(
    async (workflowState: EmailThreadWorkflowState) => {
      if (!selectedThreadId) {
        return;
      }

      setIsUpdatingWorkflow(true);
      onErrorMessage(null);

      try {
        const response = await fetch(`/api/email/threads/${selectedThreadId}/workflow`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            workflowState
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not update thread workflow.");
        }
        onRefresh();
      } catch (error) {
        onErrorMessage(
          error instanceof Error ? error.message : "Could not update thread workflow."
        );
      } finally {
        setIsUpdatingWorkflow(false);
      }
    },
    [onErrorMessage, onRefresh, selectedThreadId]
  );

  return {
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
    setLinkModalOpen: setIsLinkModalOpen,
    setSelectedDealId,
    setSelectedLinkRole,
    setSummaryDialogOpen: setIsSummaryDialogOpen,
    summarizeThread,
    summary,
    threadPreviewStates,
    updateWorkflowState
  };
}
