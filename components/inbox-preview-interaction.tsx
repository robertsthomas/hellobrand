"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Send, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface ThreadSlot {
  id: string;
  aiReply: string;
  listItem: ReactNode;
  listItemSelected: ReactNode;
  detail: ReactNode;
}

function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");

    const interval = setInterval(() => {
      indexRef.current += 1;
      const next = text.slice(0, indexRef.current);
      setDisplayed(next);
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 18);

    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

export function InboxPreviewInteraction({
  threads,
  upgradeHref
}: {
  threads: ThreadSlot[];
  upgradeHref: string;
}) {
  const [selectedId, setSelectedId] = useState(threads[0]?.id ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const selected = threads.find((t) => t.id === selectedId) ?? threads[0];

  const handleGenerate = () => {
    if (!selected) return;
    setIsGenerating(true);
    setGeneratedReply(null);
    setTimeout(() => {
      setGeneratedReply(selected.aiReply);
    }, 600);
  };

  const handleSend = () => {
    setShowUpgrade(true);
  };

  useEffect(() => {
    setIsGenerating(false);
    setGeneratedReply(null);
    setShowUpgrade(false);
  }, [selectedId]);

  return (
    <div className="relative grid min-h-0 flex-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* Thread list */}
      <div className="flex min-h-[600px] flex-col rounded-xl border border-black/[0.06] bg-white">
        <div className="border-b border-black/[0.06] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              All threads
            </span>
            <span className="text-xs text-muted-foreground">
              {threads.length} conversations
            </span>
          </div>
        </div>

        <div className="flex-1 divide-y divide-black/[0.04] overflow-auto">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setSelectedId(thread.id)}
              className="w-full"
            >
              {selectedId === thread.id
                ? thread.listItemSelected
                : thread.listItem}
            </button>
          ))}
        </div>
      </div>

      {/* Thread detail */}
      <div className="flex min-h-[600px] flex-col rounded-xl border border-black/[0.06] bg-white">
        {selected?.detail}

        {/* Reply composer */}
        <div className="border-t border-black/[0.06] px-6 py-4">
          {showUpgrade ? (
            <div className="py-2 text-center">
              <p className="text-sm text-muted-foreground">
                Connect your email to send replies directly from HelloBrand.
              </p>
              <Link
                href={upgradeHref}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-3 gap-2"
                )}
              >
                Upgrade to Premium
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="min-h-[80px] rounded-lg border border-black/8 bg-foreground/[0.02] px-4 py-3 text-sm text-muted-foreground">
                {isGenerating && generatedReply ? (
                  <TypewriterText
                    text={generatedReply}
                    onComplete={() => setIsGenerating(false)}
                  />
                ) : isGenerating ? (
                  <span className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    Drafting reply...
                  </span>
                ) : generatedReply ? (
                  <span className="text-foreground">{generatedReply}</span>
                ) : (
                  <span>Click &quot;AI Draft&quot; to generate a reply...</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-2"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {generatedReply ? "Regenerate" : "AI Draft"}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!generatedReply}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "gap-2",
                    !generatedReply
                      ? "cursor-not-allowed opacity-40"
                      : ""
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
