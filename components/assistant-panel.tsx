"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { DefaultChatTransport, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Loader2, Send, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { AssistantBlock } from "@/components/assistant-blocks";
import { AssistantHeader } from "@/components/assistant-header";
import { AssistantMessageActions } from "@/components/assistant-message-actions";
import { AssistantMarkdown } from "@/components/assistant-markdown";
import { parseAssistantUiBlock } from "@/lib/assistant/blocks";
import { assistantMessageText } from "@/lib/assistant/messages";
import {
  buildAssistantSuggestedPrompts,
  getAssistantLocationLabel
} from "@/lib/assistant/suggested-prompts";
import { cn } from "@/lib/utils";
import type { AssistantClientContext, AssistantThreadRecord, AssistantTone } from "@/lib/types";

export function AssistantPanel({
  thread,
  initialMessages,
  context,
  suggestedPromptsDismissed,
  onDismissSuggestedPrompts,
  queuedPrompt,
  onPromptConsumed,
  tone,
  onToneChange,
  onMinimize,
  onEndSession,
  onQueuePrompt
}: {
  thread: AssistantThreadRecord;
  initialMessages: UIMessage[];
  context: AssistantClientContext;
  suggestedPromptsDismissed: boolean;
  onDismissSuggestedPrompts: () => void;
  queuedPrompt: string | null;
  onPromptConsumed: () => void;
  tone: AssistantTone;
  onToneChange: (tone: AssistantTone) => void;
  onMinimize: () => void;
  onEndSession: () => Promise<void>;
  onQueuePrompt: (prompt: string | null) => void;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [input, setInput] = useState("");
  const [endingSession, setEndingSession] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const suggestedPrompts = useMemo(() => buildAssistantSuggestedPrompts(context), [context]);
  const locationLabel = useMemo(
    () => getAssistantLocationLabel(context.profileLocation),
    [context.profileLocation]
  );
  const { messages, setMessages, sendMessage, status, error, clearError, stop } = useChat({
    id: thread.id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/assistant/chat",
      body: {
        threadId: thread.id,
        scope: thread.scope,
        dealId: thread.dealId,
        context
      }
    })
  });

  const submitMessage = useCallback(
    async (text: string) => {
      const next = text.trim();
      if (!next) {
        return;
      }

      clearError();
      onDismissSuggestedPrompts();
      await sendMessage({ text: next });
    },
    [clearError, onDismissSuggestedPrompts, sendMessage]
  );

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, setMessages, thread.id]);

  useEffect(() => {
    if (!queuedPrompt) {
      return;
    }

    const normalizedQueuedPrompt = queuedPrompt.trim();
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const lastUserText = lastUserMessage ? assistantMessageText(lastUserMessage.parts) : "";

    if (lastUserText.trim() === normalizedQueuedPrompt) {
      onPromptConsumed();
      return;
    }

    void submitMessage(queuedPrompt).finally(() => onPromptConsumed());
  }, [messages, onPromptConsumed, queuedPrompt, submitMessage]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (status === "submitted" || status === "streaming") {
        return;
      }

      const next = input.trim();
      if (!next) {
        return;
      }

      setInput("");
      await submitMessage(next);
    },
    [input, status, submitMessage]
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();

      if (status === "submitted" || status === "streaming") {
        return;
      }

      const form = event.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    },
    [status]
  );

  const handleBlockNavigate = useCallback(
    (href: string, options?: { prompt?: string | null; close?: boolean }) => {
      onQueuePrompt(options?.prompt ?? null);
      router.push(href);
      if (options?.close) {
        onMinimize();
      }
    },
    [onMinimize, onQueuePrompt, router]
  );

  const handleEndSession = useCallback(async () => {
    setEndingSession(true);
    try {
      await onEndSession();
    } finally {
      setEndingSession(false);
    }
  }, [onEndSession]);

  const busy = status === "submitted" || status === "streaming" || endingSession;
  const assistantResponding = status === "submitted" || status === "streaming";

  const handleCancelResponse = useCallback(() => {
    if (!assistantResponding) {
      return;
    }

    stop();
  }, [assistantResponding, stop]);

  const handleShortenResponse = useCallback(
    async (text: string) => {
      await submitMessage(
        `Shorten your last response. Keep the same meaning, keep it grounded in this workspace, and make it easier to scan.\n\nResponse to shorten:\n${text}`
      );
    },
    [submitMessage]
  );

  const handleShowEvidence = useCallback(
    async (text: string) => {
      await submitMessage(
        `Show the exact partnership evidence behind your last response. Quote only from saved workspace evidence and clearly note anything uncertain.\n\nResponse:\n${text}`
      );
    },
    [submitMessage]
  );

  const handleDraftEmail = useCallback(
    async (text: string) => {
      await submitMessage(
        `Turn your last response into a concise creator-professional email draft with a subject line and body. Keep it grounded in this workspace.\n\nResponse:\n${text}`
      );
    },
    [submitMessage]
  );

  const handleSuggestedPromptSelect = useCallback((prompt: string) => {
    setInput(prompt);
    clearError();
    textareaRef.current?.focus();
  }, [clearError]);

  return (
      <div className="relative flex h-full flex-col">
        <AssistantHeader
          title={thread.title}
          pageTitle={context.pageTitle}
          busy={busy}
          settingsOpen={settingsOpen}
          tone={tone}
          onOpenSettings={() => setSettingsOpen(true)}
          onCloseSettings={() => setSettingsOpen(false)}
          onToneChange={onToneChange}
          onMinimize={onMinimize}
          onEndSession={() => setCloseDialogOpen(true)}
        />

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="border border-black/8 bg-white px-4 py-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/75">
              {locationLabel
                ? `Ask about risks, payments, deliverables, approvals, or use the suggested asks for ${locationLabel}.`
                : "Ask about risks, payments, deliverables, approvals, or ask for a creator-facing reply."}
            </div>
          ) : null}

          {messages.map((message) => (
            <article key={message.id} className={cn("space-y-3", message.role === "user" ? "ml-8" : "mr-8")}>
              {(() => {
                const parsedBlocks = message.parts.flatMap((part) => {
                  if (!isToolUIPart(part) || part.state !== "output-available") {
                    return [];
                  }

                  const block = parseAssistantUiBlock(part.output);
                  return block ? [block] : [];
                });
                const hasBlocks = message.role === "assistant" && parsedBlocks.length > 0;

                return (
              <div
                className={cn(
                  "border px-4 py-3 text-sm leading-6",
                  message.role === "user"
                    ? "border-ocean/20 bg-ocean/8"
                    : "border-black/8 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                )}
              >
                {message.parts.map((part, index) => {
                  if (isTextUIPart(part)) {
                    if (hasBlocks) {
                      return null;
                    }

                    return (
                      <div key={`${message.id}-${index}`}>
                        {message.role === "assistant" ? (
                          <AssistantMarkdown content={part.text} />
                        ) : (
                          <p className="whitespace-pre-wrap text-black/80 dark:text-white/82">{part.text}</p>
                        )}
                      </div>
                    );
                  }

                  if (isToolUIPart(part) && part.state === "output-available") {
                    const block = parseAssistantUiBlock(part.output);
                    return block ? (
                      <AssistantBlock
                        key={`${message.id}-${index}`}
                        block={block}
                        onNavigate={handleBlockNavigate}
                      />
                    ) : null;
                  }

                  return null;
                })}
                {(() => {
                  const textContent = message.parts
                    .filter(isTextUIPart)
                    .map((part) => part.text)
                    .join("\n\n")
                    .trim();

                  return message.role === "assistant" && textContent && !hasBlocks ? (
                    <AssistantMessageActions
                      text={textContent}
                      disabled={busy}
                      onShorten={handleShortenResponse}
                      onShowEvidence={handleShowEvidence}
                      onDraftEmail={handleDraftEmail}
                    />
                  ) : null;
                })()}
              </div>
                );
              })()}
            </article>
          ))}

          {busy ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {endingSession ? "Ending session..." : "Thinking..."}
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
            >
              {error.message}
            </div>
          ) : null}
        </div>

        <div className="border-t border-black/8 px-4 py-4 dark:border-white/10">
          <form onSubmit={handleSubmit} className="space-y-3">
            {suggestedPrompts.length > 0 && !suggestedPromptsDismissed ? (
              <div className="space-y-2 border border-black/8 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                    Suggested Asks
                  </p>
                  <div className="flex items-center gap-2">
                    {locationLabel ? (
                      <span className="text-[11px] text-muted-foreground">Based on {locationLabel}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={onDismissSuggestedPrompts}
                      className="inline-flex h-6 w-6 items-center justify-center border border-black/8 bg-white text-muted-foreground transition hover:border-black/20 hover:text-foreground dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                      aria-label="Dismiss suggested asks"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  {suggestedPrompts.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleSuggestedPromptSelect(suggestion.prompt)}
                      className="border border-black/10 bg-white px-2.5 py-2 text-left transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
                    >
                      <div className="text-[13px] font-semibold text-foreground">{suggestion.label}</div>
                      <div className="mt-0.5 text-[11px] leading-4.5 text-muted-foreground">
                        {suggestion.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              rows={3}
              placeholder="Ask about a partnership, request navigation, or draft a reply..."
              className="w-full resize-none border border-black/10 bg-white px-3 py-3 text-sm text-foreground outline-none transition focus:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:focus:border-white/20"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Grounded in your saved workspace data. Not legal advice.
              </span>
              {assistantResponding ? (
                <button
                  type="button"
                  onClick={handleCancelResponse}
                  className="inline-flex items-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Cancel
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 bg-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              )}
            </div>
          </form>
        </div>

        {closeDialogOpen ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 p-4 dark:bg-black/30">
            <div className="w-full max-w-sm border border-black/10 bg-[#f7f5f1] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121419]">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">End this chat session?</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Closing the assistant will end this session and clear this conversation window. Minimize keeps the session open.
                </p>
              </div>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCloseDialogOpen(false)}
                  disabled={endingSession}
                  className="border border-black/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:border-white/20"
                >
                  Keep chat open
                </button>
                <button
                  type="button"
                  onClick={() => void handleEndSession()}
                  disabled={endingSession}
                  className="bg-ocean px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {endingSession ? "Ending..." : "End session"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
  );
}
