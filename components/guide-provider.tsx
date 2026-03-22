"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { ProductGuideState } from "@/lib/types";
import {
  getActiveGuideStep,
  GUIDE_STEPS,
  type GuideStep
} from "@/lib/guide-registry";

interface GuideContextValue {
  activeStep: GuideStep | null;
  dismissStep: (id: string) => void;
  completeStep: (id: string) => void;
}

const GuideCtx = createContext<GuideContextValue | null>(null);

export function useGuide() {
  const ctx = useContext(GuideCtx);
  if (!ctx) {
    throw new Error("useGuide must be used within a GuideProvider.");
  }
  return ctx;
}

export function GuideProvider({
  children,
  initialGuideState,
  hasActiveWorkspace
}: {
  children: ReactNode;
  initialGuideState: ProductGuideState;
  hasActiveWorkspace: boolean;
}) {
  const pathname = usePathname();

  const [dismissedStepIds, setDismissedStepIds] = useState<Set<string>>(
    () => new Set(initialGuideState.dismissedStepIds)
  );
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(
    () => new Set(initialGuideState.completedStepIds)
  );

  const guideContext = useMemo(
    () => ({
      pathname,
      hasActiveWorkspace,
      dismissedStepIds,
      completedStepIds
    }),
    [pathname, hasActiveWorkspace, dismissedStepIds, completedStepIds]
  );

  const activeStep = useMemo(
    () => getActiveGuideStep(GUIDE_STEPS, guideContext),
    [guideContext]
  );

  // Auto-complete steps whose condition is met
  useEffect(() => {
    for (const step of GUIDE_STEPS) {
      if (completedStepIds.has(step.id) || dismissedStepIds.has(step.id))
        continue;
      if (step.autoCompleteCondition && step.autoCompleteCondition(guideContext)) {
        setCompletedStepIds((prev) => {
          const next = new Set(prev);
          next.add(step.id);
          return next;
        });
        persistGuideUpdate(step.id, "complete");
      }
    }
  }, [guideContext, completedStepIds, dismissedStepIds]);

  const dismissStep = useCallback((id: string) => {
    setDismissedStepIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    persistGuideUpdate(id, "dismiss");
  }, []);

  const completeStep = useCallback((id: string) => {
    setCompletedStepIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    persistGuideUpdate(id, "complete");
  }, []);

  const value = useMemo(
    () => ({ activeStep, dismissStep, completeStep }),
    [activeStep, dismissStep, completeStep]
  );

  return <GuideCtx.Provider value={value}>{children}</GuideCtx.Provider>;
}

function persistGuideUpdate(stepId: string, action: "dismiss" | "complete") {
  fetch("/api/onboarding/guide", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stepId, action })
  }).catch(() => {
    // Persistence failure is non-blocking; state is already
    // optimistically updated in the client.
  });
}
