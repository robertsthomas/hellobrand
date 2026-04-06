"use client";

import { useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";

import type { EmailActionItemRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function InboxActionItemRow({
  item,
  onGenerateReply,
  isGeneratingReply
}: {
  item: EmailActionItemRecord;
  onGenerateReply?: (item: EmailActionItemRecord) => void;
  isGeneratingReply?: boolean;
}) {
  const [status, setStatus] = useState(item.status);
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateStatus(newStatus: "completed" | "dismissed") {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/email/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        setStatus(newStatus);
      }
    } catch {
      // silently fail
    } finally {
      setIsUpdating(false);
    }
  }

  if (status !== "pending") {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-l-2 border-[#b42318]/30 pl-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-foreground">{item.action}</p>
        {item.dueDate ? (
          <p className="mt-1 text-[11px] text-[#b42318]">Due: {formatDate(item.dueDate)}</p>
        ) : null}
        {item.sourceText ? (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            &ldquo;{item.sourceText}&rdquo;
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1 sm:justify-start">
        <span className={`px-2 py-0.5 text-[9px] font-medium uppercase ${
          item.urgency === "high"
            ? "bg-[#fecaca] text-[#991b1b]"
            : item.urgency === "medium"
              ? "bg-[#fef3c7] text-[#92400e]"
              : "bg-[#e0e7ff] text-[#3730a3]"
        }`}>
          {item.urgency}
        </span>
        <button
          type="button"
          onClick={() => onGenerateReply?.(item)}
          disabled={isUpdating || isGeneratingReply || !onGenerateReply}
          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          aria-label="Generate reply from action item"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void updateStatus("completed")}
          disabled={isUpdating || isGeneratingReply}
          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition hover:text-[#16a34a] disabled:opacity-50"
          aria-label="Complete"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void updateStatus("dismissed")}
          disabled={isUpdating || isGeneratingReply}
          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
