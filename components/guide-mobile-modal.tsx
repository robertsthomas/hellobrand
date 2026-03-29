"use client";

import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useGuide } from "@/components/guide-provider";

export function GuideMobileModal() {
  const { activeStep, remainingCount, isMobile, dismissStep, skipAll } = useGuide();

  if (!isMobile || !activeStep) return null;

  const isLast = remainingCount <= 1;

  const handleNext = () => {
    dismissStep(activeStep.id);
  };

  const handleClose = () => {
    skipAll();
  };

  return (
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <DialogPrimitive.Content
          className="fixed top-[50%] left-[50%] z-[100] w-[calc(100%-2rem)] max-w-sm translate-x-[-50%] translate-y-[-50%] border border-black/10 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#1a1d24]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={handleClose}
        >
          {/* Header with step count and close */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {remainingCount} tip{remainingCount === 1 ? "" : "s"} remaining
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center touch-manipulation text-black/40 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
              aria-label="Close tips"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content — key forces re-render on step change */}
          <div key={activeStep.id}>
            <DialogPrimitive.Title className="mt-2 text-lg font-semibold text-foreground">
              {activeStep.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {activeStep.body}
            </DialogPrimitive.Description>
          </div>

          <button
            type="button"
            onClick={isLast ? handleClose : handleNext}
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-5 h-12 w-full touch-manipulation bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
