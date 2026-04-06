"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export const ADMIN_CACHE_TARGETS = [
  {
    key: "inbox",
    label: "Inbox",
    description: "Clear saved AI summaries, inbox preview state, AI draft/summary cache rows, and revalidate /app/inbox."
  },
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Revalidate the main workspace dashboard routes."
  },
  {
    key: "payments",
    label: "Payments",
    description: "Revalidate payment pages and refresh payment-related workspace views."
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Revalidate analytics pages that depend on cached workspace data."
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Revalidate the notifications page."
  },
  {
    key: "settings",
    label: "Settings",
    description: "Revalidate app settings pages without touching /admin."
  }
] as const;

export type AdminCacheTargetKey = (typeof ADMIN_CACHE_TARGETS)[number]["key"];

export function AdminCacheCleanerDialog({
  open,
  onOpenChange,
  selectedTargets,
  onToggleTarget,
  onSubmit,
  clearing
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTargets: AdminCacheTargetKey[];
  onToggleTarget: (target: AdminCacheTargetKey) => void;
  onSubmit: () => void;
  clearing: boolean;
}) {
  const hasSelection = selectedTargets.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Clear app caches</DialogTitle>
          <DialogDescription>
            Pick the app areas to clear. This does not reload or revalidate the admin page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {ADMIN_CACHE_TARGETS.map((target) => {
            const checked = selectedTargets.includes(target.key);

            return (
              <label
                key={target.key}
                className="flex items-start gap-3 border border-neutral-200 px-3 py-3"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggleTarget(target.key)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-neutral-900">{target.label}</div>
                  <div className="mt-1 text-sm text-neutral-600">{target.description}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-neutral-500">
            {hasSelection
              ? `${selectedTargets.length} target${selectedTargets.length === 1 ? "" : "s"} selected`
              : "Select at least one target."}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={!hasSelection || clearing}
              onClick={onSubmit}
            >
              {clearing ? "Clearing..." : "Clear selected"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
