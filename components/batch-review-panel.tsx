"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, FileText, Loader2, MoveRight } from "lucide-react";

import type { IntakeBatchGroupRecord, IntakeBatchRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BatchReviewPanelProps {
  batch: IntakeBatchRecord;
  documentNames: Record<string, string>;
}

function GroupCard({
  group,
  documentNames,
  allGroups,
  onConfirm,
  onReassign,
  isConfirming
}: {
  group: IntakeBatchGroupRecord;
  documentNames: Record<string, string>;
  allGroups: IntakeBatchGroupRecord[];
  onConfirm: (groupId: string, brandName: string, campaignName: string) => void;
  onReassign: (documentId: string, fromGroupId: string, toGroupId: string) => void;
  isConfirming: boolean;
}) {
  const [brandName, setBrandName] = useState(group.label);
  const [campaignName, setCampaignName] = useState(group.label);
  const isConfirmed = group.status === "confirmed";
  const otherGroups = allGroups.filter((g) => g.id !== group.id && g.status === "pending");

  return (
    <div
      className={cn(
        "border bg-white p-6 dark:bg-white/[0.03]",
        isConfirmed
          ? "border-emerald-500/30 dark:border-emerald-400/20"
          : "border-black/8 dark:border-white/10"
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{group.label}</h3>
              {group.confidence !== null && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(group.confidence * 100)}% confidence
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {group.documentIds.length} document{group.documentIds.length === 1 ? "" : "s"}
            </p>
          </div>
          {isConfirmed && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Deal created
            </span>
          )}
        </div>

        <div className="space-y-2">
          {group.documentIds.map((docId) => (
            <div
              key={docId}
              className="flex items-center justify-between gap-3 border border-black/6 px-3 py-2 dark:border-white/8"
            >
              <span className="inline-flex items-center gap-2 text-sm text-foreground">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {documentNames[docId] ?? docId.slice(0, 8)}
              </span>
              {!isConfirmed && otherGroups.length > 0 && (
                <select
                  className="border border-black/10 bg-transparent px-2 py-1 text-xs text-muted-foreground dark:border-white/10"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onReassign(docId, group.id, e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="" disabled>
                    Move to...
                  </option>
                  {otherGroups.map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        {!isConfirmed && (
          <div className="space-y-3 border-t border-black/6 pt-4 dark:border-white/8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Brand name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Campaign name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={isConfirming || !brandName.trim()}
              onClick={() => onConfirm(group.id, brandName, campaignName)}
              className="inline-flex items-center gap-2 bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-50"
            >
              {isConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoveRight className="h-4 w-4" />
              )}
              Create deal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function BatchReviewPanel({ batch, documentNames }: BatchReviewPanelProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(batch.groups);
  const [confirmingGroupId, setConfirmingGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(groupId: string, brandName: string, campaignName: string) {
    setConfirmingGroupId(groupId);
    setError(null);

    try {
      const response = await fetch(`/api/intake/batch/${batch.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "confirm_group",
          groupId,
          brandName,
          campaignName
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not confirm group.");
      }

      setGroups((current) =>
        current.map((g) =>
          g.id === groupId ? { ...g, status: "confirmed" as const } : g
        )
      );

      const allConfirmed = groups.every(
        (g) => g.id === groupId || g.status !== "pending"
      );
      if (allConfirmed && payload.session?.id) {
        router.push(`/app/intake/${payload.session.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setConfirmingGroupId(null);
    }
  }

  async function handleReassign(documentId: string, fromGroupId: string, toGroupId: string) {
    setError(null);

    try {
      const response = await fetch(`/api/intake/batch/${batch.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reassign_document",
          documentId,
          fromGroupId,
          toGroupId
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not reassign document.");
      }

      if (payload.batch?.groups) {
        setGroups(payload.batch.groups);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const pendingCount = groups.filter((g) => g.status === "pending").length;
  const confirmedCount = groups.filter((g) => g.status === "confirmed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{groups.length} group{groups.length === 1 ? "" : "s"} detected</span>
        <span className="text-black/20 dark:text-white/20">|</span>
        <span>{confirmedCount} confirmed</span>
        <span className="text-black/20 dark:text-white/20">|</span>
        <span>{pendingCount} pending</span>
      </div>

      <div className="grid gap-6">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            documentNames={documentNames}
            allGroups={groups}
            onConfirm={handleConfirm}
            onReassign={handleReassign}
            isConfirming={confirmingGroupId === group.id}
          />
        ))}
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}
    </div>
  );
}
