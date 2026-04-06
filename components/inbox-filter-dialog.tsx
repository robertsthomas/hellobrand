"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import type { DealRecord } from "@/lib/types";

import { InboxSelect } from "@/components/inbox-select";

export function InboxFilterDialog({
  open,
  onOpenChange,
  draftProviderFilter,
  setDraftProviderFilter,
  draftDealFilter,
  setDraftDealFilter,
  draftWorkflowFilter,
  setDraftWorkflowFilter,
  connectedProviders,
  deals,
  onClear,
  onApply
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftProviderFilter: string;
  setDraftProviderFilter: (value: string) => void;
  draftDealFilter: string;
  setDraftDealFilter: (value: string) => void;
  draftWorkflowFilter: string;
  setDraftWorkflowFilter: (value: string) => void;
  connectedProviders: string[];
  deals: DealRecord[];
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Filter inbox</DialogTitle>
          <DialogDescription>
            Narrow the inbox to the linked workspace email threads you want to review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <InboxSelect value={draftProviderFilter} onChange={setDraftProviderFilter}>
            <option value="">All providers</option>
            <option value="gmail" disabled={!connectedProviders.includes("gmail")}>Gmail</option>
            <option value="outlook" disabled={!connectedProviders.includes("outlook")}>Outlook</option>
            <option value="yahoo" disabled={!connectedProviders.includes("yahoo")}>Yahoo</option>
          </InboxSelect>

          <InboxSelect value={draftDealFilter} onChange={setDraftDealFilter}>
            <option value="">All partnerships</option>
            {deals.map((deal) => {
              const labels = getDisplayDealLabels(deal);

              return (
                <option key={deal.id} value={deal.id}>
                  {labels.campaignName ?? deal.campaignName}
                </option>
              );
            })}
          </InboxSelect>

          <InboxSelect value={draftWorkflowFilter} onChange={setDraftWorkflowFilter}>
            <option value="">All states</option>
            <option value="needs_review">Needs review</option>
            <option value="needs_reply">Needs reply</option>
            <option value="draft_ready">Draft ready</option>
            <option value="waiting_on_them">Waiting</option>
            <option value="closed">Closed</option>
          </InboxSelect>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClear}
            className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:w-auto"
          >
            Clear
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              className="h-9 w-full border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:border-black/20 sm:w-auto"
            >
              Apply
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
