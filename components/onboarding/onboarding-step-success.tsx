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

/**
 * Generate a symmetric starburst path centered at (cx, cy).
 * Points alternate between outer and inner radii every (360/points/2) degrees.
 */
function starburstPath(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const steps = points * 2;
  const angleStep = (Math.PI * 2) / steps;
  // Start from top (-90°)
  const offset = -Math.PI / 2;
  const coords: string[] = [];
  for (let i = 0; i < steps; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = offset + i * angleStep;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    coords.push(`${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`);
  }
  return `M${coords[0]}L${coords.slice(1).join(" ")}Z`;
}

const CX = 60;
const CY = 60;
const STARBURST_OUTER = starburstPath(CX, CY, 52, 43, 12);
const STARBURST_INNER = starburstPath(CX, CY, 48, 40, 12);

// Checkmark centered at (60, 60): midpoint of M43,62 L55,74 L77,48 is (60, 61)
const CHECKMARK = "M43 62L55 74L77 48";

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Static sparkles */}
      <svg
        viewBox="0 0 180 180"
        fill="none"
        className="absolute -inset-5 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)]"
      >
        <path
          d="M145 28L147 35L154 37L147 39L145 46L143 39L136 37L143 35L145 28Z"
          className="fill-primary/60"
        />
        <circle cx="30" cy="140" r="3" className="fill-primary/40" />
        <circle cx="42" cy="42" r="2" className="fill-primary/35" />
      </svg>
      {/* Spinning starburst — transform-origin at exact center */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className="h-full w-full animate-[spin_14s_linear_infinite]"
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <path d={STARBURST_OUTER} className="fill-primary/30" />
        <path d={STARBURST_INNER} className="fill-primary/60" />
      </svg>
      {/* Static checkmark */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className="absolute inset-0 h-full w-full animate-[scalebeat_3s_ease-in-out_infinite]"
        style={{ transformOrigin: "center center" }}
      >
        <path
          d={CHECKMARK}
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
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-black/55 sm:max-w-sm sm:text-[15px] dark:text-white/60 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
        Your creator profile is ready. Start uploading partnership documents to
        build your first workspace.
      </p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500 fill-mode-both">
        <button
          type="button"
          onClick={onContinue}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
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
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      data-form-type="other"
                      className="h-11 flex-1 rounded-none border border-black/12 bg-white px-4 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/30 dark:border-white/12 dark:bg-white/[0.04]"
                      autoFocus={index === 0}
                    />
                    {emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmail(index)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-black/30 transition hover:bg-black/5 hover:text-black/60 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/60"
                      >
                        <Trash2 className="h-4 w-4" />
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
                  "w-full bg-primary text-primary-foreground hover:bg-primary/90",
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
