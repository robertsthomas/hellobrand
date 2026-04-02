"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EmailDealCandidateMatchGroup } from "@/lib/types";

type UseInboxCandidateDiscoveryOptions = {
  onErrorMessage: (value: string | null) => void;
  onRefresh: () => void;
};

export function useInboxCandidateDiscovery({
  onErrorMessage,
  onRefresh
}: UseInboxCandidateDiscoveryOptions) {
  const discoveryRequestRef = useRef<AbortController | null>(null);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isReviewingCandidates, setIsReviewingCandidates] = useState(false);
  const [candidateGroups, setCandidateGroups] = useState<EmailDealCandidateMatchGroup[]>(
    []
  );
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [primaryCandidateId, setPrimaryCandidateId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      discoveryRequestRef.current?.abort();
    };
  }, []);

  const closeCandidateModal = useCallback(() => {
    setIsCandidateModalOpen(false);
  }, []);

  const toggleCandidate = useCallback((candidateId: string) => {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    );
    setPrimaryCandidateId((current) => (current === candidateId ? null : current));
  }, []);

  const choosePrimaryCandidate = useCallback((candidateId: string) => {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId) ? current : [candidateId, ...current]
    );
    setPrimaryCandidateId(candidateId);
  }, []);

  const discoverCandidates = useCallback(async () => {
    discoveryRequestRef.current?.abort();
    const controller = new AbortController();
    discoveryRequestRef.current = controller;
    setIsDiscovering(true);
    onErrorMessage(null);

    try {
      const response = await fetch("/api/email/candidates/discover", {
        method: "POST",
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not scan inbox for deal threads.");
      }

      const groups = (payload.candidates ?? []) as EmailDealCandidateMatchGroup[];
      setCandidateGroups(groups);
      const nextSelectedIds = groups.flatMap((group) =>
        group.matches.map((match) => match.candidate.id)
      );
      setSelectedCandidateIds(nextSelectedIds);
      setPrimaryCandidateId(nextSelectedIds[0] ?? null);
      setIsCandidateModalOpen(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      onErrorMessage(
        error instanceof Error ? error.message : "Could not scan inbox for deal threads."
      );
    } finally {
      if (discoveryRequestRef.current === controller) {
        discoveryRequestRef.current = null;
      }
      setIsDiscovering(false);
    }
  }, [onErrorMessage]);

  const cancelDiscovery = useCallback(() => {
    discoveryRequestRef.current?.abort();
    discoveryRequestRef.current = null;
    setIsDiscovering(false);
  }, []);

  const reviewCandidates = useCallback(
    async (action: "confirm" | "reject_all") => {
      const visibleIds = candidateGroups.flatMap((group) =>
        group.matches.map((match) => match.candidate.id)
      );
      const confirmIds = action === "confirm" ? selectedCandidateIds : [];
      const rejectIds = action === "confirm" ? [] : visibleIds;

      if (confirmIds.length === 0 && rejectIds.length === 0) {
        return;
      }

      setIsReviewingCandidates(true);
      setIsCandidateModalOpen(false);
      setCandidateGroups([]);
      setSelectedCandidateIds([]);
      setPrimaryCandidateId(null);

      try {
        const response = await fetch("/api/email/candidates/review", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            primaryCandidateId:
              action === "confirm" ? primaryCandidateId ?? confirmIds[0] ?? null : null,
            referenceIds:
              action === "confirm"
                ? confirmIds.filter((candidateId) => candidateId !== (primaryCandidateId ?? confirmIds[0] ?? null))
                : [],
            rejectIds
          })
        });

        if (!response.ok) {
          const payload = await response.json();
          onErrorMessage(payload.error ?? "Could not review email candidates.");
        }

        onRefresh();
      } catch (error) {
        onErrorMessage(
          error instanceof Error ? error.message : "Could not review email candidates."
        );
        onRefresh();
      } finally {
        setIsReviewingCandidates(false);
      }
    },
    [candidateGroups, onErrorMessage, onRefresh, primaryCandidateId, selectedCandidateIds]
  );

  const dismissCandidate = useCallback(
    async (candidateId: string) => {
      onErrorMessage(null);

      setCandidateGroups((current) =>
        current
          .map((group) => ({
            ...group,
            matches: group.matches.filter((match) => match.candidate.id !== candidateId)
          }))
          .filter((group) => group.matches.length > 0)
      );
      setSelectedCandidateIds((current) => current.filter((id) => id !== candidateId));
      setPrimaryCandidateId((current) => (current === candidateId ? null : current));

      try {
        const response = await fetch("/api/email/candidates/review", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            rejectIds: [candidateId]
          })
        });

        if (!response.ok) {
          const payload = await response.json();
          onErrorMessage(payload.error ?? "Could not dismiss email candidate.");
        }
      } catch (error) {
        onErrorMessage(
          error instanceof Error ? error.message : "Could not dismiss email candidate."
        );
      }
    },
    [onErrorMessage]
  );

  return {
    candidateGroups,
    cancelDiscovery,
    closeCandidateModal,
    discoverCandidates,
    dismissCandidate,
    isCandidateModalOpen,
    isDiscovering,
    isReviewingCandidates,
    reviewCandidates,
    choosePrimaryCandidate,
    primaryCandidateId,
    selectedCandidateIds,
    toggleCandidate
  };
}
