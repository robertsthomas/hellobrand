"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { UIMessage } from "ai";
import { Bot, Loader2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { AssistantPanel } from "@/components/assistant-panel";
import { assistantPageTitle, isValidAssistantTab } from "@/lib/assistant/app-manual";
import { assistantRecordToUIMessage } from "@/lib/assistant/messages";
import type {
  AssistantClientContext,
  AssistantDealTab,
  AssistantTone,
  AssistantThreadRecord,
  AssistantTrigger
} from "@/lib/types";

type AssistantContextValue = {
  open: boolean;
  openAssistant: (options?: { trigger?: AssistantTrigger | null; prompt?: string | null }) => void;
  closeAssistant: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);
const assistantToneStorageKey = "hb-assistant-tone";

async function loadOrCreateThreadWithMode(
  scope: "user" | "deal",
  dealId: string | null,
  context: AssistantClientContext,
  forceNew: boolean
) {
  if (!forceNew) {
    const params = new URLSearchParams({ scope });
    if (dealId) {
      params.set("dealId", dealId);
    }

    const threadsRes = await fetch(`/api/assistant/threads?${params.toString()}`);
    const threadsPayload = await threadsRes.json();
    const thread = (threadsPayload.threads?.[0] ?? null) as AssistantThreadRecord | null;

    if (thread) {
      const detailRes = await fetch(`/api/assistant/threads/${thread.id}`);
      const detailPayload = await detailRes.json();
      return {
        thread,
        messages: (detailPayload.messages ?? []).map(assistantRecordToUIMessage)
      };
    }
  }

  const createRes = await fetch("/api/assistant/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope,
      dealId,
      context
    })
  });
  const createPayload = await createRes.json();
  return {
    thread: createPayload.thread as AssistantThreadRecord,
    messages: [] as UIMessage[]
  };
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dealId = pathname.startsWith("/app/deals/") ? pathname.split("/")[3] ?? null : null;
  const currentTab = searchParams.get("tab");
  const [open, setOpen] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<AssistantTrigger | null>(null);
  const [tone, setTone] = useState<AssistantTone>("professional");
  const [threadState, setThreadState] = useState<{
    thread: AssistantThreadRecord;
    messages: UIMessage[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [forceNewThread, setForceNewThread] = useState(false);

  useEffect(() => {
    const storedTone = window.localStorage.getItem(assistantToneStorageKey);

    if (
      storedTone === "professional" ||
      storedTone === "friendly" ||
      storedTone === "direct" ||
      storedTone === "warm"
    ) {
      setTone(storedTone);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(assistantToneStorageKey, tone);
  }, [tone]);

  const context = useMemo<AssistantClientContext>(
    () => ({
      pathname,
      pageTitle: assistantPageTitle(pathname),
      dealId,
      tab: isValidAssistantTab(currentTab) ? (currentTab as AssistantDealTab) : null,
      trigger,
      tone
    }),
    [currentTab, dealId, pathname, tone, trigger]
  );

  const scope = dealId ? "deal" : "user";

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadOrCreateThreadWithMode(scope, dealId, context, forceNewThread)
      .then((payload) => {
        if (!cancelled) {
          setThreadState(payload);
          setForceNewThread(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [context, dealId, forceNewThread, open, scope]);

  const openAssistant = useCallback(
    (options?: { trigger?: AssistantTrigger | null; prompt?: string | null }) => {
      setTrigger(options?.trigger ?? null);
      setQueuedPrompt(options?.prompt ?? options?.trigger?.prompt ?? null);
      setOpen(true);
    },
    []
  );

  const closeAssistant = useCallback(() => {
    setOpen(false);
  }, []);

  const endAssistantSession = useCallback(async () => {
    const threadId = threadState?.thread.id;

    try {
      if (threadId) {
        await fetch(`/api/assistant/threads/${threadId}`, {
          method: "DELETE"
        });
      }
    } catch {
      // Reset locally even if the delete request fails.
    }

    setOpen(false);
    setQueuedPrompt(null);
    setTrigger(null);
    setThreadState(null);
    setForceNewThread(true);
  }, [threadState?.thread.id]);

  return (
    <AssistantContext.Provider value={{ open, openAssistant, closeAssistant }}>
      {children}

      <button
        type="button"
        onClick={() => openAssistant()}
        data-guide="assistant-fab"
        className="group fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-ocean text-sm font-semibold text-white shadow-[0_18px_40px_rgba(14,116,144,0.35)] transition-[width,transform] duration-300 ease-out hover:w-[132px] hover:translate-y-[-1px] dark:border-white/10"
        aria-label="Open assistant"
      >
        <span className="shrink-0">
          <Bot className="h-5 w-5" />
        </span>
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-hover:ml-2 group-hover:max-w-[80px] group-hover:opacity-100">
          Assistant
        </span>
      </button>

      {open ? (
        <div className="fixed inset-y-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-[440px] flex-col border border-black/10 bg-[#f7f5f1] shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#121419]">
          {loading || !threadState ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assistant...
            </div>
          ) : (
            <AssistantPanel
              key={`${threadState.thread.id}-${context.pathname}-${context.tab ?? "none"}`}
              thread={threadState.thread}
              initialMessages={threadState.messages}
              context={context}
              queuedPrompt={queuedPrompt}
              onPromptConsumed={() => setQueuedPrompt(null)}
              tone={tone}
              onToneChange={setTone}
              onMinimize={closeAssistant}
              onEndSession={endAssistantSession}
              onQueuePrompt={setQueuedPrompt}
            />
          )}
        </div>
      ) : null}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);

  if (!context) {
    throw new Error("useAssistant must be used inside AssistantProvider.");
  }

  return context;
}
