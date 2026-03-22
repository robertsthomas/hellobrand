"use client";

import { useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Static sparkles — outside the spin */}
      <svg
        viewBox="0 0 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute -inset-5 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)]"
      >
        {/* 4-point sparkle top-right */}
        <path
          d="M145 28L147 35L154 37L147 39L145 46L143 39L136 37L143 35L145 28Z"
          fill="#8FBFA8"
          opacity="0.5"
        />
        {/* Dot bottom-left */}
        <circle cx="30" cy="140" r="3" fill="#8FBFA8" opacity="0.3" />
        {/* Small dot top-left */}
        <circle cx="42" cy="42" r="2" fill="#8FBFA8" opacity="0.25" />
      </svg>
      {/* Spinning badge body */}
      <svg
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full animate-[spin_8s_linear_infinite]"
      >
        {/* Soft shadow */}
        <path
          d="M70 14L83.5 24L100.5 21.4L105.2 38L120 47.4L115.6 64L120 80.6L105.2 90L100.5 106.6L83.5 104L70 114L56.5 104L39.5 106.6L34.8 90L20 80.6L24.4 64L20 47.4L34.8 38L39.5 21.4L56.5 24L70 14Z"
          fill="#C5DECE"
          opacity="0.18"
          transform="translate(2, 3)"
        />
        {/* Badge body */}
        <path
          d="M70 12L84 22L101.5 19.3L106.3 36.5L121.5 46.2L117 63.5L121.5 80.8L106.3 90.5L101.5 107.7L84 105L70 115L56 105L38.5 107.7L33.7 90.5L18.5 80.8L23 63.5L18.5 46.2L33.7 36.5L38.5 19.3L56 22L70 12Z"
          fill="#8FBFA8"
        />
      </svg>
      {/* Static checkmark overlay */}
      <svg
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M48 68L62 82L92 50"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function OnboardingStepSuccess({
  displayName,
  onContinue
}: {
  displayName: string;
  onContinue: () => void;
}) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [emails, setEmails] = useState<string[]>([""]);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const addEmailField = () => {
    if (emails.length < 5) {
      setEmails([...emails, ""]);
    }
  };

  const updateEmail = (index: number, value: string) => {
    const next = [...emails];
    next[index] = value;
    setEmails(next);
  };

  const removeEmail = (index: number) => {
    if (emails.length <= 1) return;
    setEmails(emails.filter((_, i) => i !== index));
  };

  const validEmails = emails.filter((e) => e.trim().includes("@"));

  const handleSendInvites = async () => {
    if (validEmails.length === 0) return;
    setIsSending(true);

    // Fire-and-forget — no backend needed for v1, just show success
    // In the future this could call an invite API
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSending(false);
    setSent(true);
  };

  const firstName = displayName.split(/\s+/)[0] || "Creator";

  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated badge */}
      <div className="animate-in fade-in zoom-in-50 duration-500">
        <VerifiedBadge className="h-28 w-28 sm:h-36 sm:w-36" />
      </div>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink sm:text-3xl animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
        You&apos;re all set, {firstName}!
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-black/55 dark:text-white/60 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
        Your creator profile is ready. Start uploading partnership documents to
        build your first workspace.
      </p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500 fill-mode-both">
        <button
          type="button"
          onClick={onContinue}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 w-full bg-ink text-white hover:bg-ink/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          )}
        >
          Continue to app
        </button>
        <button
          type="button"
          onClick={() => setShowInviteDialog(true)}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-12 w-full"
          )}
        >
          Invite a friend
        </button>
      </div>

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-sm p-0">
          <DialogHeader className="border-b border-black/8 px-6 pt-6 pb-4 text-left dark:border-white/10">
            <DialogTitle className="text-lg font-semibold text-ink">
              Invite friends
            </DialogTitle>
            <DialogDescription className="text-sm text-black/55 dark:text-white/60">
              Know a creator who&apos;d love HelloBrand? Send them an invite.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4">
            {sent ? (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ocean/10">
                  <Send className="h-4.5 w-4.5 text-ocean" />
                </div>
                <p className="mt-3 text-sm font-medium text-ink">
                  Invites sent!
                </p>
                <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                  We&apos;ll let them know you referred them.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emails.map((email, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="friend@email.com"
                      className="h-11 flex-1 rounded-none border border-black/12 bg-white px-4 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/30 dark:border-white/12 dark:bg-white/[0.04]"
                      autoFocus={index === 0}
                    />
                    {emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmail(index)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-black/30 transition hover:bg-black/5 hover:text-black/60 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {emails.length < 5 && (
                  <button
                    type="button"
                    onClick={addEmailField}
                    className="flex items-center gap-1.5 text-sm font-medium text-black/50 transition hover:text-black/70 dark:text-white/50 dark:hover:text-white/70"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add another
                  </button>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-black/8 px-6 py-4 dark:border-white/10">
            {sent ? (
              <button
                type="button"
                onClick={() => setShowInviteDialog(false)}
                className={cn(buttonVariants(), "w-full")}
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendInvites}
                disabled={validEmails.length === 0 || isSending}
                className={cn(
                  buttonVariants(),
                  "w-full bg-ink text-white hover:bg-ink/90 dark:bg-white dark:text-black dark:hover:bg-white/90",
                  validEmails.length === 0 || isSending
                    ? "cursor-not-allowed opacity-40"
                    : ""
                )}
              >
                {isSending
                  ? "Sending..."
                  : `Send invite${validEmails.length > 1 ? "s" : ""}`}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
