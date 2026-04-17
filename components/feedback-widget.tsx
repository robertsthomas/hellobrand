"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { ArrowUp, MessageSquareMore, X } from "lucide-react";

import { submitFeedbackAction } from "@/app/actions";
import type { FeedbackActionState } from "@/app/server-actions/feedback-actions";
import { SubmitButton } from "@/components/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getNextFeedbackEligibilityTime } from "@/lib/feedback-schedule";
import { captureAppEvent } from "@/lib/posthog/events";
import { cn } from "@/lib/utils";

const INITIAL_STATE: FeedbackActionState = {
  status: "idle",
  message: null,
  submissionId: null
};

const FEEDBACK_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function getDismissStorageKey(viewerId: string) {
  return `hellobrand.feedback.dismissed.${viewerId}`;
}

function getCooldownStorageKey(viewerId: string) {
  return `hellobrand.feedback.cooldown_until.${viewerId}`;
}

function getEligibilityStorageKey(viewerId: string) {
  return `hellobrand.feedback.eligible_at.${viewerId}`;
}

function resolvePageGroup(pagePath: string) {
  if (pagePath === "/app" || pagePath === "/app/dashboard") {
    return "dashboard";
  }

  if (pagePath.startsWith("/app/p/")) {
    return "workspace";
  }

  if (pagePath.startsWith("/app/inbox")) {
    return "inbox";
  }

  if (pagePath.startsWith("/app/payments")) {
    return "payments";
  }

  if (pagePath.startsWith("/app/settings")) {
    return "settings";
  }

  if (pagePath.startsWith("/app/help")) {
    return "help";
  }

  if (pagePath.startsWith("/app/search")) {
    return "search";
  }

  if (pagePath.startsWith("/app/intake")) {
    return "intake";
  }

  return "other";
}

function readActiveCooldown(viewerId: string) {
  const rawValue = window.localStorage.getItem(getCooldownStorageKey(viewerId));
  const parsed = Number(rawValue ?? "");
  return Number.isFinite(parsed) && parsed > Date.now();
}

function readOrCreateEligibilityTime(viewerId: string) {
  const key = getEligibilityStorageKey(viewerId);
  const rawValue = window.localStorage.getItem(key);
  const parsed = Number(rawValue ?? "");

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const eligibleAt = getNextFeedbackEligibilityTime(Date.now());
  window.localStorage.setItem(key, String(eligibleAt));
  return eligibleAt;
}

function FeedbackFields({
  selectedScore,
  onSelectScore,
  message,
  onMessageChange,
  requestedFollowUp,
  onRequestedFollowUpChange,
  pagePath,
  pageTitle,
  dealId,
  errorMessage
}: {
  selectedScore: number | null;
  onSelectScore: (value: number) => void;
  message: string;
  onMessageChange: (value: string) => void;
  requestedFollowUp: boolean;
  onRequestedFollowUpChange: (checked: boolean) => void;
  pagePath: string;
  pageTitle: string;
  dealId: string | null;
  errorMessage: string | null;
}) {
  return (
    <>
      <input type="hidden" name="score" value={selectedScore ?? ""} />
      <input type="hidden" name="pagePath" value={pagePath} />
      <input type="hidden" name="pageTitle" value={pageTitle} />
      <input type="hidden" name="dealId" value={dealId ?? ""} />
      <input type="hidden" name="requestedFollowUp" value={requestedFollowUp ? "true" : "false"} />

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Rate HelloBrand</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={selectedScore === value}
              onClick={() => onSelectScore(value)}
              className={cn(
                buttonVariants({
                  variant: selectedScore === value ? "default" : "outline",
                  className: "h-11 w-full px-0 text-base font-semibold"
                })
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="feedback-message"
          className="text-sm font-medium text-foreground"
        >
          Notes
        </label>
        <Textarea
          id="feedback-message"
          name="message"
          value={message}
          onChange={(event) => onMessageChange(event.currentTarget.value)}
          maxLength={2000}
          placeholder="Optional context"
          className="min-h-24"
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <Checkbox
          checked={requestedFollowUp}
          onCheckedChange={(checked) => onRequestedFollowUpChange(checked === true)}
          className="mt-0.5"
        />
        <span>Email me for follow-up.</span>
      </label>

      {errorMessage ? (
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
      ) : null}
    </>
  );
}

function FeedbackSuccess({
  message,
  onClose
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <p className="text-base font-medium text-foreground">Thanks for the feedback.</p>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}

// fallow-ignore-next-line complexity
export function FeedbackWidget({
  viewerId,
  pagePath,
  pageTitle,
  dealId,
  openRequestKey,
  onDismissedChange
}: {
  viewerId: string;
  pagePath: string;
  pageTitle: string;
  dealId?: string | null;
  openRequestKey?: number;
  onDismissedChange?: (dismissed: boolean) => void;
}) {
  const posthog = usePostHog();
  const [state, formAction] = useActionState(submitFeedbackAction, INITIAL_STATE);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [requestedFollowUp, setRequestedFollowUp] = useState(false);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const successTimerRef = useRef<number | null>(null);
  const eligibilityTimerRef = useRef<number | null>(null);
  const pageGroup = resolvePageGroup(pagePath);
  const isSubmitted = state.status === "success";

  useEffect(() => {
    const dismissedForSession =
      window.sessionStorage.getItem(getDismissStorageKey(viewerId)) === "1";
    const hiddenForCooldown = readActiveCooldown(viewerId);
    const eligibleAt = readOrCreateEligibilityTime(viewerId);
    const hiddenForSchedule = eligibleAt > Date.now();

    onDismissedChange?.(dismissedForSession);

    if (eligibilityTimerRef.current) {
      window.clearTimeout(eligibilityTimerRef.current);
      eligibilityTimerRef.current = null;
    }

    if (dismissedForSession || hiddenForCooldown || hiddenForSchedule) {
      setHidden(true);

      if (!dismissedForSession && !hiddenForCooldown && hiddenForSchedule) {
        eligibilityTimerRef.current = window.setTimeout(() => {
          setHidden(false);
          window.requestAnimationFrame(() => setRevealed(true));
        }, eligibleAt - Date.now());
      }
    } else {
      setHidden(false);
      window.requestAnimationFrame(() => setRevealed(true));
    }

    return () => {
      if (eligibilityTimerRef.current) {
        window.clearTimeout(eligibilityTimerRef.current);
        eligibilityTimerRef.current = null;
      }
    };
  }, [viewerId, onDismissedChange]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    setIsMobileViewport(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isSubmitted) {
      return;
    }

    window.localStorage.setItem(
      getCooldownStorageKey(viewerId),
      String(Date.now() + FEEDBACK_COOLDOWN_MS)
    );
    window.sessionStorage.removeItem(getDismissStorageKey(viewerId));
    onDismissedChange?.(false);
    setOpen(true);

    successTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setHidden(true);
    }, 4000);

    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, [isSubmitted, viewerId, onDismissedChange]);

  useEffect(() => {
    if (!openRequestKey) {
      return;
    }

    window.sessionStorage.removeItem(getDismissStorageKey(viewerId));
    setHidden(false);
    setRevealed(true);
    setOpen(true);
    onDismissedChange?.(false);
  }, [openRequestKey, viewerId, onDismissedChange]);

  function handleOpen() {
    setOpen(true);
    captureAppEvent(posthog, "feedback_widget_opened", {
      pagePath,
      pageGroup,
      pageTitle,
      hasDeal: Boolean(dealId)
    });
  }

  function dismissForSession() {
    window.sessionStorage.setItem(getDismissStorageKey(viewerId), "1");
    setOpen(false);
    setHidden(true);
    onDismissedChange?.(true);
    captureAppEvent(posthog, "feedback_widget_dismissed", {
      pagePath,
      pageGroup,
      pageTitle,
      hasDeal: Boolean(dealId)
    });
  }

  function handleCloseAfterSuccess() {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }

    setOpen(false);
    setHidden(true);
  }

  function handleRequestedFollowUpChange(checked: boolean) {
    if (!requestedFollowUp && checked) {
      captureAppEvent(posthog, "feedback_followup_requested", {
        pagePath,
        pageGroup,
        pageTitle,
        hasDeal: Boolean(dealId)
      });
    }

    setRequestedFollowUp(checked);
  }

  if (hidden) {
    return null;
  }

  return (
    <>
      <div className="pointer-events-none fixed right-6 bottom-24 z-40 hidden lg:block">
        <div
          className={cn(
            "pointer-events-auto transition-[transform,opacity] duration-300",
            revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          )}
        >
          {!isMobileViewport && open ? (
            <Card className="w-[22rem] gap-0 bg-background">
              <CardHeader className="border-b border-black/8 px-5 pt-5 pb-3 dark:border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">Feedback</CardTitle>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center border border-black/8 text-muted-foreground transition hover:text-foreground dark:border-white/10"
                    aria-label="Close feedback form"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <form action={formAction}>
                <CardContent className="space-y-4 pt-5">
                  {isSubmitted ? (
                    <FeedbackSuccess
                      message={state.message ?? "Thanks for the feedback."}
                      onClose={handleCloseAfterSuccess}
                    />
                  ) : (
                    <FeedbackFields
                      selectedScore={selectedScore}
                      onSelectScore={setSelectedScore}
                      message={message}
                      onMessageChange={setMessage}
                      requestedFollowUp={requestedFollowUp}
                      onRequestedFollowUpChange={handleRequestedFollowUpChange}
                      pagePath={pagePath}
                      pageTitle={pageTitle}
                      dealId={dealId ?? null}
                      errorMessage={state.status === "error" ? state.message : null}
                    />
                  )}
                </CardContent>
                {!isSubmitted ? (
                  <CardFooter className="justify-between border-t border-black/8 pt-3 pb-4 dark:border-white/10">
                    <Button type="button" variant="ghost" onClick={dismissForSession}>
                      Not now
                    </Button>
                    <SubmitButton
                      pendingLabel="Sending feedback..."
                      showSpinner
                      disabled={selectedScore === null}
                      className={cn(buttonVariants(), selectedScore === null ? "opacity-60" : "")}
                    >
                      Send feedback
                    </SubmitButton>
                  </CardFooter>
                ) : null}
              </form>
            </Card>
          ) : (
            <Card className="w-[19rem] bg-background">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <MessageSquareMore className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">App feedback</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleOpen}
                    className="h-9 w-9 text-emerald-700 hover:bg-transparent hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-transparent dark:hover:text-emerald-200"
                    aria-label="Open feedback form"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={dismissForSession}
                    className="inline-flex h-9 w-9 items-center justify-center border border-black/8 text-muted-foreground transition hover:text-foreground dark:border-white/10"
                    aria-label="Dismiss feedback launcher"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="fixed right-4 bottom-20 z-40 lg:hidden">
        {!open ? (
          <div
            className={cn(
              "transition-[transform,opacity] duration-300",
              revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            )}
          >
            <Button type="button" onClick={handleOpen} className="shadow-[var(--shadow-floating)]">
              <MessageSquareMore className="h-4 w-4" />
              Feedback
            </Button>
          </div>
        ) : null}
      </div>

      <Sheet open={isMobileViewport && open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="border-border p-0 lg:hidden">
          <SheetHeader className="border-b border-black/8 px-5 py-3 text-left dark:border-white/10">
            <SheetTitle className="text-lg">Feedback</SheetTitle>
          </SheetHeader>
          <form action={formAction} className="space-y-4 px-5 py-4">
            {isSubmitted ? (
              <FeedbackSuccess
                message={state.message ?? "Thanks for the feedback."}
                onClose={handleCloseAfterSuccess}
              />
            ) : (
              <>
                <FeedbackFields
                  selectedScore={selectedScore}
                  onSelectScore={setSelectedScore}
                  message={message}
                  onMessageChange={setMessage}
                  requestedFollowUp={requestedFollowUp}
                  onRequestedFollowUpChange={handleRequestedFollowUpChange}
                  pagePath={pagePath}
                  pageTitle={pageTitle}
                  dealId={dealId ?? null}
                  errorMessage={state.status === "error" ? state.message : null}
                />
                <div className="flex items-center justify-between gap-3 border-t border-black/8 pt-4 pb-1 dark:border-white/10">
                  <Button type="button" variant="ghost" onClick={dismissForSession}>
                    Not now
                  </Button>
                  <SubmitButton
                    pendingLabel="Sending feedback..."
                    showSpinner
                    disabled={selectedScore === null}
                    className={cn(buttonVariants(), selectedScore === null ? "opacity-60" : "")}
                  >
                    Send feedback
                  </SubmitButton>
                </div>
              </>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
