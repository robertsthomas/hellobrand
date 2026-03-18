"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DuplicateMatch } from "@/lib/duplicate-detection";
import { humanizeToken } from "@/lib/utils";

function matchReasonLabel(reason: DuplicateMatch["matchReason"]): string {
  switch (reason) {
    case "exact_content":
      return "Exact document match";
    case "same_brand_and_terms":
      return "Same brand with matching terms";
    case "similar_content":
      return "Similar content detected";
    default:
      return "Potential match";
  }
}

function confidenceLabel(score: number): string {
  if (score >= 0.9) return "Very high";
  if (score >= 0.7) return "High";
  if (score >= 0.5) return "Moderate";
  return "Low";
}

function confidenceColor(score: number): string {
  if (score >= 0.9) return "text-red-600";
  if (score >= 0.7) return "text-orange-600";
  if (score >= 0.5) return "text-amber-600";
  return "text-muted-foreground";
}

export function DuplicateDealDialog({
  matches,
  onAddToExisting,
  onCreateNew,
  isSubmitting = false
}: {
  matches: DuplicateMatch[];
  onAddToExisting: (dealId: string) => void;
  onCreateNew: () => void;
  isSubmitting?: boolean;
}) {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(
    matches[0]?.dealId ?? null
  );

  if (matches.length === 0) return null;

  return (
    <div className="border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Possible duplicate workspace
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This looks similar to an existing workspace. You can add these documents
              to the existing workspace instead of creating a new one.
            </p>
          </div>

          <div className="space-y-2">
            {matches.slice(0, 3).map((match) => (
              <button
                key={match.dealId}
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedDealId(match.dealId)}
                className={`w-full border p-4 text-left transition ${
                  selectedDealId === match.dealId
                    ? "border-primary bg-primary/5 dark:border-primary/40"
                    : "border-black/8 bg-white hover:border-black/15 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {match.campaignName}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {match.brandName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        {matchReasonLabel(match.matchReason)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {humanizeToken(match.status)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-xs font-medium ${confidenceColor(match.matchScore)}`}>
                      {confidenceLabel(match.matchScore)} match
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {Math.round(match.matchScore * 100)}%
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={isSubmitting || !selectedDealId}
              onClick={() => selectedDealId && onAddToExisting(selectedDealId)}
            >
              {isSubmitting ? "Adding..." : "Add to existing workspace"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCreateNew}
            >
              <Plus className="h-4 w-4" />
              Create new workspace anyway
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
