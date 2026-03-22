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
  remainingCount: number;
  isMobile: boolean;
  dismissStep: (id: string) => void;
  completeStep: (id: string) => void;
  skipAll: () => void;
}

const GuideCtx = createContext<GuideContextValue | null>(null);

function findVisibleGuideAnchor(selector: string) {
  const elements = Array.from(document.querySelectorAll(selector));

  return (
    elements.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? null
  );
}

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
  hasActiveWorkspace,
  visibilityKey,
  onUnavailableStep,
  onActiveStepChange
}: {
  children: ReactNode;
  initialGuideState: ProductGuideState;
  hasActiveWorkspace: boolean;
  visibilityKey?: string | number | boolean;
  onUnavailableStep?: (step: GuideStep) => boolean;
  onActiveStepChange?: (step: GuideStep | null) => void;
}) {
  const pathname = usePathname();

  const [dismissedStepIds, setDismissedStepIds] = useState<Set<string>>(
    () => new Set(initialGuideState.dismissedStepIds)
  );
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(
    () => new Set(initialGuideState.completedStepIds)
  );

  useEffect(() => {
    setDismissedStepIds(new Set(initialGuideState.dismissedStepIds));
    setCompletedStepIds(new Set(initialGuideState.completedStepIds));
  }, [
    initialGuideState.dismissedStepIds,
    initialGuideState.completedStepIds
  ]);

  // lg breakpoint matches the sidebar visibility (hidden lg:flex)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const guideContext = useMemo(
    () => ({
      pathname,
      hasActiveWorkspace,
      isMobile,
      dismissedStepIds,
      completedStepIds
    }),
    [pathname, hasActiveWorkspace, isMobile, dismissedStepIds, completedStepIds]
  );

  // Find the first eligible step whose anchor is actually visible in the DOM.
  const [activeStep, setActiveStep] = useState<GuideStep | null>(null);

  useEffect(() => {
    // Small delay so DOM has settled after navigation
    const timer = setTimeout(() => {
      let candidate = getActiveGuideStep(GUIDE_STEPS, guideContext);
      const tried = new Set<string>();

      while (candidate && !tried.has(candidate.id)) {
        // On mobile, show all steps as modals — no anchor visibility check needed
        if (isMobile) break;

        const el = findVisibleGuideAnchor(candidate.anchorSelector);
        if (el && el.getBoundingClientRect().width > 0) {
          break; // anchor is visible
        }

        if (onUnavailableStep?.(candidate)) {
          setActiveStep(null);
          return;
        }

        tried.add(candidate.id);
        // Try next step by temporarily adding this one to dismissed
        const tempCtx = {
          ...guideContext,
          dismissedStepIds: new Set([...guideContext.dismissedStepIds, ...tried])
        };
        candidate = getActiveGuideStep(GUIDE_STEPS, tempCtx);
      }

      setActiveStep(candidate && !tried.has(candidate.id) ? candidate : null);
    }, 100);

    return () => clearTimeout(timer);
  }, [guideContext, onUnavailableStep, visibilityKey]);

  useEffect(() => {
    onActiveStepChange?.(activeStep);
  }, [activeStep, onActiveStepChange]);

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

  const skipAll = useCallback(() => {
    const allIds = GUIDE_STEPS.map((s) => s.id);
    setDismissedStepIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
    // Persist all as dismissed
    allIds.forEach((id) => persistGuideUpdate(id, "dismiss"));
  }, []);

  const remainingCount = useMemo(() => {
    let count = 0;
    for (const step of GUIDE_STEPS) {
      if (dismissedStepIds.has(step.id) || completedStepIds.has(step.id)) continue;
      if (step.desktopOnly && isMobile) continue;
      count++;
    }
    return count;
  }, [dismissedStepIds, completedStepIds, isMobile]);

  const value = useMemo(
    () => ({ activeStep, remainingCount, isMobile, dismissStep, completeStep, skipAll }),
    [activeStep, remainingCount, isMobile, dismissStep, completeStep, skipAll]
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
