"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, FileText, Merge, X } from "lucide-react";

import { deleteIntakeDraftAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { DuplicateMatch } from "@/lib/duplicate-detection";
import type { IntakeSessionStatus } from "@/lib/types";
import { humanizeToken } from "@/lib/utils";

function matchReasonLabel(reason: DuplicateMatch["matchReason"]): string {
  switch (reason) {
    case "exact_content":
      return "Exact document match";
    case "same_brand_and_terms":
      return "Same brand with similar terms";
    case "similar_content":
      return "Similar content found";
    default:
      return "Potential match";
  }
}

export function IntakeDuplicateWarning({
  sessionId,
  dealId,
  status
}: {
  sessionId: string;
  dealId: string;
  status: IntakeSessionStatus;
}) {
  const router = useRouter();
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (status !== "ready_for_confirmation" || dismissed || hasChecked) {
      return;
    }

    let disposed = false;

    async function check() {
      try {
        const response = await fetch(`/api/intake/${sessionId}/duplicate-check`, {
          cache: "no-store"
        });
        if (!response.ok || disposed) return;

        const payload = await response.json();
        const results = (payload?.matches ?? []) as DuplicateMatch[];
        if (!disposed) {
          setMatches(results);
          setHasChecked(true);
        }
      } catch {
        // Silently fail
      }
    }

    void check();

    return () => {
      disposed = true;
    };
  }, [sessionId, status, dismissed, hasChecked]);

  const handleDeleteAndNavigate = useCallback(
    async (targetDealId: string) => {
      setIsActing(true);
      try {
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("redirectTo", `/app/deals/${targetDealId}`);
        await deleteIntakeDraftAction(formData);
      } catch {
        // The server action redirects, so we only reach here on error
        setIsActing(false);
      }
    },
    [sessionId]
  );

  const handleAddToExisting = useCallback(
    async (targetDealId: string) => {
      setIsActing(true);
      try {
        // Move documents from current partnership to the existing partnership
        const response = await fetch(`/api/intake/${sessionId}/merge`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetDealId })
        });

        if (response.ok) {
          router.push(`/app/deals/${targetDealId}`);
          router.refresh();
        } else {
          setIsActing(false);
        }
      } catch {
        setIsActing(false);
      }
    },
    [sessionId, router]
  );

  if (dismissed || matches.length === 0) {
    return null;
  }

  const topMatch = matches[0];

  return (
    <div className="w-full max-w-3xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-500/20 dark:bg-amber-900/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                This may be a duplicate
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The content you uploaded looks similar to an existing workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 text-muted-foreground transition hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {topMatch.campaignName}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {topMatch.brandName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {matchReasonLabel(topMatch.matchReason)}
                  </span>
                  <span>{humanizeToken(topMatch.status)}</span>
                  <span>{Math.round(topMatch.matchScore * 100)}% confidence</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isActing}
              onClick={() => void handleAddToExisting(topMatch.dealId)}
            >
              <Merge className="h-4 w-4" />
              {isActing ? "Moving..." : "Add to existing workspace"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isActing}
              onClick={() => void handleDeleteAndNavigate(topMatch.dealId)}
            >
              <ArrowRight className="h-4 w-4" />
              Delete this and go to existing
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isActing}
              onClick={() => setDismissed(true)}
            >
              Continue with new workspace
            </Button>
          </div>

          {matches.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              {matches.length - 1} other potential match{matches.length > 2 ? "es" : ""} found.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
