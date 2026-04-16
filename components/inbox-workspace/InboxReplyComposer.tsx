/**
 * Reply composer pinned to the bottom of the thread detail panel.
 * Handles AI reply generation, refinement popovers, draft saving,
 * invoice attachment, and the prompt command dialog.
 */
"use client";

import Link from "next/link";
import { ChevronDown, LoaderCircle, Paperclip, Send, Sparkles, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DRAFT_REFINEMENT_OPTIONS } from "./helpers";
import type { DraftPromptSuggestion, ThreadInvoiceAttachment } from "./helpers";

type InboxReplyComposerProps = {
  replyBody: string;
  replyBodyRef: React.RefObject<HTMLTextAreaElement | null>;
  replyJourney: string;
  isDrafting: boolean;
  shouldHighlightAiReply: boolean;
  canRefineGeneratedReply: boolean;
  canClearReplyText: boolean;
  canSendReply: boolean;
  isSavingDraft: boolean;
  isSendingReply: boolean;
  replySignatureMissingFields: string[];
  isReplySignatureBannerVisible: boolean;
  replySignatureBannerStateKey: string;
  isInvoiceAttached: boolean;
  canAttachInvoice: boolean;
  selectedThreadInvoiceAttachment: ThreadInvoiceAttachment | null;
  aiReplyControlRef: React.RefObject<HTMLDivElement | null>;
  aiReplyMenuWidth: number | null;
  promptActionControlRef: React.RefObject<HTMLDivElement | null>;
  promptActionMenuWidth: number | null;
  openRefinementPopover: string | null;
  draftInstructions: string;
  trimmedDraftInstructions: string;
  isPromptCommandOpen: boolean;
  isLoadingSuggestions: boolean;
  promptSuggestions: DraftPromptSuggestion[];
  onReplyBodyChange: (value: string, element: HTMLTextAreaElement) => void;
  onDraftReply: () => void;
  onCancelDraftReply: () => void;
  onClearDraftComposer: () => void;
  onRefineGeneratedDraft: (instruction: string) => void;
  onSaveDraft: (status: string) => void;
  onSendReply: () => void;
  onSetInvoiceAttached: (value: boolean) => void;
  onSetOpenRefinementPopover: (value: "length" | "tone" | "focus" | null) => void;
  onSetPromptCommandOpen: (value: boolean) => void;
  onSetDraftInstructions: (value: string) => void;
  onApplyPromptToNextDraft: () => void;
  onClearPromptDialog: () => void;
  onRunPromptForDraft: () => void;
  onDismissSignatureBanner: () => void;
};

export function InboxReplyComposer({
  replyBody,
  replyBodyRef,
  replyJourney,
  isDrafting,
  shouldHighlightAiReply,
  canRefineGeneratedReply,
  canClearReplyText,
  canSendReply,
  isSavingDraft,
  isSendingReply,
  replySignatureMissingFields,
  isReplySignatureBannerVisible,
  replySignatureBannerStateKey,
  isInvoiceAttached,
  canAttachInvoice,
  selectedThreadInvoiceAttachment,
  aiReplyControlRef,
  aiReplyMenuWidth,
  promptActionControlRef,
  promptActionMenuWidth,
  openRefinementPopover,
  draftInstructions,
  trimmedDraftInstructions,
  isPromptCommandOpen,
  isLoadingSuggestions,
  promptSuggestions,
  onReplyBodyChange,
  onDraftReply,
  onCancelDraftReply,
  onClearDraftComposer,
  onRefineGeneratedDraft,
  onSaveDraft,
  onSendReply,
  onSetInvoiceAttached,
  onSetOpenRefinementPopover,
  onSetPromptCommandOpen,
  onSetDraftInstructions,
  onApplyPromptToNextDraft,
  onClearPromptDialog,
  onRunPromptForDraft,
  onDismissSignatureBanner,
}: InboxReplyComposerProps) {
  return (
    <>
      <div className="shrink-0 border-t border-black/8 bg-white px-6 pb-4 pt-4 xl:mr-28">
        <div className="space-y-3">
          {replyJourney === "ai_generated" &&
          replySignatureMissingFields.length > 0 &&
          isReplySignatureBannerVisible ? (
            <div className="flex items-start justify-between gap-3 border border-black/8 bg-[#f7f4ed] px-3 py-2">
              <p className="text-[12px] leading-5 text-foreground">
                <span className="font-semibold">
                  Missing {replySignatureMissingFields.join(", ")}
                </span>{" "}
                in your creator profile.{" "}
                <Link
                  href="/app/settings/profile"
                  className="font-medium underline underline-offset-4 transition hover:text-primary"
                >
                  Set up your creator profile
                </Link>{" "}
                to improve your email signature.
              </p>
              <button
                type="button"
                onClick={onDismissSignatureBanner}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-black/8 bg-white text-muted-foreground transition hover:bg-secondary"
                aria-label="Dismiss inbox signature reminder"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className="border border-black/8 bg-foreground/[0.02] px-4 py-3 text-sm text-muted-foreground">
            <div>
              <Textarea
                ref={replyBodyRef}
                rows={1}
                value={replyBody}
                onChange={(event) => {
                  onReplyBodyChange(event.currentTarget.value, event.currentTarget);
                }}
                placeholder={
                  replyJourney === "ai_set"
                    ? 'Refine your prompt, then click "Generate"...'
                    : 'Type a reply or click "AI Reply" to generate one...'
                }
                className="min-h-6 resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 text-[12px] leading-6 text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 disabled:opacity-100"
              />
              {isDrafting ? (
                <span className="mt-2 flex items-center gap-2 text-[11px] text-primary">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Writing draft...
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div ref={aiReplyControlRef} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onDraftReply()}
                  disabled={isDrafting}
                  className={`inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition disabled:opacity-60 ${
                    shouldHighlightAiReply
                      ? "animate-pulse border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-black/10 text-foreground hover:bg-black/[0.03]"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isDrafting
                    ? "Replying..."
                    : replyJourney === "ai_generated"
                      ? "Regenerate"
                      : replyJourney === "ai_set"
                        ? "Generate"
                        : "AI Reply"}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Open AI reply options"
                      className="inline-flex h-9 w-10 items-center justify-center border border-l-0 border-black/10 text-muted-foreground transition hover:bg-black/[0.03] hover:text-foreground"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="top"
                    sideOffset={4}
                    style={aiReplyMenuWidth ? { width: `${aiReplyMenuWidth}px` } : undefined}
                    className="rounded-none border-black/10 p-0"
                  >
                    <DropdownMenuItem
                      onSelect={() => onSetPromptCommandOpen(true)}
                      className="w-full rounded-none px-3 py-2.5 text-[12px] font-medium"
                    >
                      Add prompt
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={onClearDraftComposer}
                      disabled={!canClearReplyText}
                      className="w-full rounded-none px-3 py-2.5 text-[12px] font-medium"
                    >
                      Clear text
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {isDrafting ? (
                <button
                  type="button"
                  onClick={onCancelDraftReply}
                  className="inline-flex h-9 items-center border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                >
                  Cancel
                </button>
              ) : null}
              {canRefineGeneratedReply ? (
                <>
                  <Popover
                    open={openRefinementPopover === "length"}
                    onOpenChange={(open) => onSetOpenRefinementPopover(open ? "length" : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 border border-black/10 bg-secondary/20 px-3 text-[12px] font-medium text-foreground transition hover:border-black/25 hover:bg-secondary/28"
                      >
                        Length
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="top"
                      className="w-40 rounded-none border-black/10 p-1"
                    >
                      <div className="space-y-1">
                        {DRAFT_REFINEMENT_OPTIONS.length.map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => onRefineGeneratedDraft(option.instruction)}
                            className="block w-full rounded-none px-3 py-2 text-left text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover
                    open={openRefinementPopover === "tone"}
                    onOpenChange={(open) => onSetOpenRefinementPopover(open ? "tone" : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 border border-black/10 bg-secondary/20 px-3 text-[12px] font-medium text-foreground transition hover:border-black/25 hover:bg-secondary/28"
                      >
                        Tone
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="top"
                      className="w-40 rounded-none border-black/10 p-1"
                    >
                      <div className="space-y-1">
                        {DRAFT_REFINEMENT_OPTIONS.tone.map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => onRefineGeneratedDraft(option.instruction)}
                            className="block w-full rounded-none px-3 py-2 text-left text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover
                    open={openRefinementPopover === "focus"}
                    onOpenChange={(open) => onSetOpenRefinementPopover(open ? "focus" : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-9 min-w-[92px] items-center justify-between gap-2 border border-black/10 bg-secondary/20 px-3 text-[12px] font-medium text-foreground transition hover:border-black/25 hover:bg-secondary/28"
                      >
                        Focus
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="top"
                      className="w-44 rounded-none border-black/10 p-1"
                    >
                      <div className="space-y-1">
                        {DRAFT_REFINEMENT_OPTIONS.focus.map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => onRefineGeneratedDraft(option.instruction)}
                            className="block w-full rounded-none px-3 py-2 text-left text-[12px] font-medium text-foreground transition hover:bg-black/[0.03]"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSaveDraft("in_progress")}
                disabled={isSavingDraft || !replyBody.trim()}
                className="inline-flex h-9 items-center border border-black/10 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03] disabled:opacity-40"
              >
                {isSavingDraft ? "Saving..." : "Save draft"}
              </button>
              {canAttachInvoice ? (
                <button
                  type="button"
                  onClick={() => onSetInvoiceAttached(!isInvoiceAttached)}
                  className={`inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition ${
                    isInvoiceAttached
                      ? "border-foreground bg-foreground text-background"
                      : "border-black/10 text-foreground hover:bg-black/[0.03]"
                  }`}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {isInvoiceAttached ? "Invoice attached" : "Attach invoice"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onSendReply()}
                disabled={!canSendReply || isSendingReply}
                className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {isSendingReply ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
          {selectedThreadInvoiceAttachment ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-black/8 bg-secondary/10 px-4 py-3 text-[12px] text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">
                  {selectedThreadInvoiceAttachment.invoiceNumber}
                </p>
                <p>{selectedThreadInvoiceAttachment.fileName}</p>
                {!canAttachInvoice ? (
                  <p className="mt-1">This invoice has been voided and will not be attached.</p>
                ) : null}
              </div>
              <Link
                href={`/api/documents/${selectedThreadInvoiceAttachment.documentId}/content`}
                target="_blank"
                className="inline-flex border-b border-black/20 pb-1 text-[12px] font-medium text-foreground transition hover:border-black/50"
              >
                Preview invoice
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <CommandDialog
        open={isPromptCommandOpen}
        onOpenChange={onSetPromptCommandOpen}
        title="Add draft prompt"
        description="Add guidance for the AI draft reply."
      >
        <CommandInput
          value={draftInstructions}
          onValueChange={onSetDraftInstructions}
          placeholder="Tone, boundaries, points to mention..."
          aria-label="Additional prompt for AI draft"
        />
        <CommandList className="max-h-[240px]">
          <CommandEmpty>
            <p className="text-[13px] text-muted-foreground">
              Type a custom prompt or pick a suggestion below.
            </p>
          </CommandEmpty>
          <CommandGroup heading="Suggestions">
            {isLoadingSuggestions && promptSuggestions.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-muted-foreground">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Generating suggestions...
              </div>
            ) : (
              promptSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.id}
                  value={suggestion.label}
                  onSelect={() => onSetDraftInstructions(suggestion.prompt)}
                >
                  {suggestion.label}
                </CommandItem>
              ))
            )}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-between border-t border-black/8 px-4 py-3 dark:border-white/10">
          <p className="text-[12px] text-muted-foreground">Applies to the next draft only.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearPromptDialog}
              className="inline-flex h-8 items-center px-3 text-[12px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              Clear
            </button>
            <div ref={promptActionControlRef} className="flex items-stretch">
              <button
                type="button"
                onClick={onApplyPromptToNextDraft}
                disabled={!trimmedDraftInstructions}
                className="inline-flex h-8 items-center bg-primary px-4 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add prompt
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open prompt actions"
                    disabled={!trimmedDraftInstructions || isDrafting}
                    className="inline-flex h-8 w-8 items-center justify-center border-l border-white/15 bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  sideOffset={4}
                  style={
                    promptActionMenuWidth ? { width: `${promptActionMenuWidth}px` } : undefined
                  }
                  className="rounded-none border-black/10 p-0"
                >
                  <DropdownMenuItem
                    onSelect={() => onRunPromptForDraft()}
                    className="w-full rounded-none px-3 py-2.5 text-[12px] font-medium"
                  >
                    Use prompt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CommandDialog>
    </>
  );
}
