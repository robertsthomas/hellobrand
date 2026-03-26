"use client";

import { useEffect, useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Hand, X } from "lucide-react";
import { toast } from "sonner";

import {
  buildProfileOnboardingSubmission,
  type ProfileOnboardingDraft
} from "@/lib/onboarding-draft";
import type { ProfilePlatform } from "@/lib/profile-metadata";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { OnboardingStepIdentity } from "@/components/onboarding/onboarding-step-identity";
import { OnboardingStepPlatforms } from "@/components/onboarding/onboarding-step-platforms";
import { OnboardingStepProfile } from "@/components/onboarding/onboarding-step-profile";
import { OnboardingStepSuccess } from "@/components/onboarding/onboarding-step-success";

const TOTAL_STEPS = 3;

type OnboardingStep = 1 | 2 | 3 | "success";

type OnboardingState = ProfileOnboardingDraft & {
  step: OnboardingStep;
  showExitDialog: boolean;
};

type OnboardingAction =
  | { type: "set_step"; step: OnboardingStep }
  | { type: "complete" }
  | { type: "set_show_exit_dialog"; value: boolean }
  | {
      type: "set_field";
      field: keyof ProfileOnboardingDraft;
      value: ProfileOnboardingDraft[keyof ProfileOnboardingDraft];
    };

const initialState: OnboardingState = {
  step: 1,
  displayName: "",
  contactEmail: "",
  primaryHandle: "",
  selectedPlatforms: [],
  platformHandles: {},
  contentCategory: "",
  bio: "",
  accentColor: "",
  showExitDialog: false
};

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "set_step":
      return {
        ...state,
        step: action.step
      };
    case "complete":
      return {
        ...state,
        step: "success"
      };
    case "set_show_exit_dialog":
      return {
        ...state,
        showExitDialog: action.value
      };
    case "set_field":
      return {
        ...state,
        [action.field]: action.value
      };
    default:
      return state;
  }
}

function hexToRgbTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function lightenForDark(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = 0.45;
  return `${Math.round(r + (255 - r) * mix)} ${Math.round(g + (255 - g) * mix)} ${Math.round(b + (255 - b) * mix)}`;
}

function lightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = 0.45;
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

function useAccentPreview(accentColor: string) {
  useEffect(() => {
    if (!accentColor) {
      document.querySelector("style[data-onboarding-accent]")?.remove();
      return;
    }

    const lightRgb = hexToRgbTriplet(accentColor);
    const darkRgb = lightenForDark(accentColor);
    const darkHex = lightenHex(accentColor);

    const style = document.createElement("style");
    style.setAttribute("data-onboarding-accent", "true");
    style.textContent = `
      :root {
        --primary-rgb: ${lightRgb};
        --ocean-rgb: ${lightRgb};
        --ring-rgb: ${lightRgb};
        --primary: ${accentColor};
      }
      html.dark {
        --primary-rgb: ${darkRgb};
        --ocean-rgb: ${darkRgb};
        --ring-rgb: ${darkRgb};
        --primary: ${darkHex};
      }
    `;

    document.querySelector("style[data-onboarding-accent]")?.remove();
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [accentColor]);
}

export function ProfileOnboardingModal({
  viewer
}: {
  viewer: { id: string; email: string; displayName: string };
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const [isPending, startTransition] = useTransition();

  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    contactEmail: viewer.email
  });
  const {
    step,
    displayName,
    contactEmail,
    primaryHandle,
    selectedPlatforms,
    platformHandles,
    contentCategory,
    bio,
    accentColor,
    showExitDialog
  } = state;

  useAccentPreview(accentColor);

  const setDisplayName = (value: string) =>
    dispatch({ type: "set_field", field: "displayName", value });
  const setPrimaryHandle = (value: string) =>
    dispatch({ type: "set_field", field: "primaryHandle", value });
  const setSelectedPlatforms = (value: ProfilePlatform[]) =>
    dispatch({ type: "set_field", field: "selectedPlatforms", value });
  const setPlatformHandles = (value: Record<string, string>) =>
    dispatch({ type: "set_field", field: "platformHandles", value });
  const setContentCategory = (value: string) =>
    dispatch({ type: "set_field", field: "contentCategory", value });
  const setBio = (value: string) =>
    dispatch({ type: "set_field", field: "bio", value });
  const setAccentColor = (value: string) =>
    dispatch({ type: "set_field", field: "accentColor", value });
  const setStep = (nextStep: OnboardingStep) =>
    dispatch({ type: "set_step", step: nextStep });
  const setShowExitDialog = (value: boolean) =>
    dispatch({ type: "set_show_exit_dialog", value });

  const handleComplete = () => {
    startTransition(async () => {
      try {
        const payload = buildProfileOnboardingSubmission({
          displayName,
          contactEmail,
          primaryHandle,
          selectedPlatforms,
          platformHandles,
          contentCategory,
          bio,
          accentColor
        });

        const response = await fetch("/api/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error ?? "Something went wrong. Please try again.");
          return;
        }

        dispatch({ type: "complete" });
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  const handleExit = () => {
    signOut({ redirectUrl: "/login" });
  };

  const isFormStep = step !== "success";
  const numericStep = typeof step === "number" ? step : TOTAL_STEPS;
  const progressWidth = `${(numericStep / TOTAL_STEPS) * 100}%`;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-[#0f1115]">
      {/* Thin top bar with logo */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/5 px-4 sm:h-16 sm:px-8 dark:border-white/8">
        <div className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
            <Hand className="hello-hand-wave h-4 w-4 rotate-[18deg]" strokeWidth={2.15} />
          </div>
          <span className="text-lg font-bold tracking-[-0.04em] text-foreground">
            HelloBrand
          </span>
        </div>
        {isFormStep && (
          <button
            type="button"
            onClick={() => setShowExitDialog(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-black/40 transition hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
            aria-label="Exit onboarding"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </header>

      {/* Centered content area */}
      <main className={`flex flex-1 items-start justify-center overflow-auto px-4 pb-12 sm:px-6 sm:pb-24 ${
        step === "success" ? "pt-10 sm:pt-28" : "pt-8 sm:pt-20"
      }`}>
        <div className="w-full max-w-lg">
          {/* Progress bar - only on form steps */}
          {isFormStep && (
            <div className="mb-8">
              <div className="text-xs font-medium text-black/60 dark:text-white/60">
                Step {numericStep} of {TOTAL_STEPS}
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/6 dark:bg-white/8">
                <div
                  className="h-full rounded-full bg-ink transition-all duration-500 ease-out dark:bg-white"
                  style={{ width: progressWidth }}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <OnboardingStepIdentity
              displayName={displayName}
              setDisplayName={setDisplayName}
              contactEmail={contactEmail}
              primaryHandle={primaryHandle}
              setPrimaryHandle={setPrimaryHandle}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              onContinue={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <OnboardingStepPlatforms
              primaryHandle={primaryHandle}
              selectedPlatforms={selectedPlatforms}
              setSelectedPlatforms={setSelectedPlatforms}
              platformHandles={platformHandles}
              setPlatformHandles={setPlatformHandles}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <OnboardingStepProfile
              contentCategory={contentCategory}
              setContentCategory={setContentCategory}
              bio={bio}
              setBio={setBio}
              onBack={() => setStep(2)}
              onComplete={handleComplete}
              isPending={isPending}
            />
          )}

          {step === "success" && (
            <OnboardingStepSuccess
              displayName={displayName}
              onContinue={() => router.refresh()}
            />
          )}
        </div>
      </main>

      {/* Exit confirmation dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave setup?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress won&apos;t be saved. You&apos;ll be signed out and
              can complete setup the next time you log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue setup</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
