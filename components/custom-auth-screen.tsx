"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Hand, LockKeyhole, Mail } from "lucide-react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureAppEvent } from "@/lib/posthog/events";
import { safeRedirectPath } from "@/lib/safe-redirect";

type AuthMode = "sign-in" | "sign-up";
type VerificationStep = "details" | "sign-up-code" | "sign-in-second-factor";
type SignInSecondFactorState =
  | {
      strategy: "email_code";
      safeIdentifier: string | null;
    }
  | {
      strategy: "phone_code";
      safeIdentifier: string | null;
    }
  | {
      strategy: "totp" | "backup_code";
      safeIdentifier: null;
    };

const rightPanelHighlights = [
  "Contracts broken down into plain English",
  "Emails matched to the right partnership",
  "Every deal organized in one workspace"
];

function deriveMode(value: string | null): AuthMode {
  return value === "sign-up" ? "sign-up" : "sign-in";
}

function getErrorMessages(error: unknown): string[] {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    const messages = (error as { errors: Array<{ longMessage?: string; message?: string }> }).errors
      .map((entry) => entry.longMessage ?? entry.message)
      .filter((entry): entry is string => Boolean(entry));

    if (messages.length > 0) {
      return messages;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return [error.message];
  }

  return ["Something went wrong. Please try again."];
}

function factorSafeIdentifier(factor: unknown) {
  if (
    typeof factor === "object" &&
    factor !== null &&
    "safeIdentifier" in factor &&
    typeof (factor as { safeIdentifier?: unknown }).safeIdentifier === "string"
  ) {
    return (factor as { safeIdentifier: string }).safeIdentifier;
  }

  return null;
}

export function CustomAuthScreen({
  signUpsEnabled = true
}: {
  signUpsEnabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();

  const queryMode = useMemo(() => {
    const nextMode = deriveMode(searchParams.get("mode"));
    return !signUpsEnabled && nextMode === "sign-up" ? "sign-in" : nextMode;
  }, [searchParams, signUpsEnabled]);
  const redirectTarget = useMemo(
    () => safeRedirectPath(searchParams.get("redirect")),
    [searchParams]
  );

  const [mode, setMode] = useState<AuthMode>(queryMode);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("details");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [signInSecondFactor, setSignInSecondFactor] = useState<SignInSecondFactorState | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const verificationFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMode(queryMode);
  }, [queryMode]);

  useEffect(() => {
    setErrorMessages([]);
    setIsSubmitting(false);
  }, [mode, verificationStep]);

  function navigateAfterAuth(decorateUrl: (path: string) => string) {
    const url = decorateUrl(redirectTarget);
    if (url.startsWith("http")) {
      window.location.replace(url);
      return;
    }

    router.replace(url);
    router.refresh();
  }

  async function finalizeSignIn() {
    const { error } = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          return;
        }

        navigateAfterAuth(decorateUrl);
      }
    });

    if (error) {
      throw error;
    }
  }

  async function finalizeSignUp() {
    const { error } = await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          return;
        }

        navigateAfterAuth(decorateUrl);
      }
    });

    if (error) {
      throw error;
    }
  }

  function updateMode(nextMode: AuthMode) {
    if (!signUpsEnabled && nextMode === "sign-up") {
      setErrorMessages(["New sign-ups are paused right now."]);
      return;
    }

    captureAppEvent(posthog, "auth_mode_switched", {
      mode: nextMode,
      redirectTarget
    });
    setMode(nextMode);
    setVerificationStep("details");
    setVerificationCode("");
    setSignInSecondFactor(null);
    setVerificationNotice(null);
    setErrorMessages([]);
    const nextUrl = new URLSearchParams();
    if (nextMode === "sign-up") {
      nextUrl.set("mode", "sign-up");
    }
    if (redirectTarget !== "/app") {
      nextUrl.set("redirect", redirectTarget);
    }
    router.replace(`/login${nextUrl.toString() ? `?${nextUrl.toString()}` : ""}`, {
      scroll: false
    });
  }

  function resetVerificationState() {
    setVerificationStep("details");
    setVerificationCode("");
    setSignInSecondFactor(null);
    setVerificationNotice(null);
  }

  async function moveToSignInSecondFactor() {
    const supportedSecondFactors = signIn.supportedSecondFactors ?? [];
    const preferredSecondFactor =
      supportedSecondFactors.find((factor) => factor.strategy === "totp") ??
      supportedSecondFactors.find((factor) => factor.strategy === "email_code") ??
      supportedSecondFactors.find((factor) => factor.strategy === "phone_code") ??
      supportedSecondFactors.find((factor) => factor.strategy === "backup_code");

    if (!preferredSecondFactor) {
      setErrorMessages([
        "Your account requires an additional verification method that this screen does not support yet."
      ]);
      return;
    }

    if (preferredSecondFactor.strategy === "totp") {
      setSignInSecondFactor({ strategy: "totp", safeIdentifier: null });
      setVerificationStep("sign-in-second-factor");
      setVerificationNotice("Enter the code from your authenticator app to finish signing in.");
      return;
    }

    if (preferredSecondFactor.strategy === "backup_code") {
      setSignInSecondFactor({ strategy: "backup_code", safeIdentifier: null });
      setVerificationStep("sign-in-second-factor");
      setVerificationNotice("Enter one of your backup codes to finish signing in.");
      return;
    }

    if (preferredSecondFactor.strategy === "email_code") {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) {
        throw error;
      }

      const safeIdentifier = factorSafeIdentifier(preferredSecondFactor);
      setSignInSecondFactor({
        strategy: "email_code",
        safeIdentifier
      });
      setVerificationStep("sign-in-second-factor");
      setVerificationNotice(
        `We sent a verification code to ${safeIdentifier ?? "your email"}.`
      );
      return;
    }

    const { error } = await signIn.mfa.sendPhoneCode();
    if (error) {
      throw error;
    }

    const safeIdentifier = factorSafeIdentifier(preferredSecondFactor);
    setSignInSecondFactor({
      strategy: "phone_code",
      safeIdentifier
    });
    setVerificationStep("sign-in-second-factor");
    setVerificationNotice(
      `We sent a verification code to ${safeIdentifier ?? "your phone"}.`
    );
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_sign_in_submitted", {
      redirectTarget
    });

    try {
      const { error } = await signIn.password({
        identifier: signInEmail.trim(),
        password: signInPassword
      });

      if (error) {
        throw error;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
        setVerificationCode("");
        await moveToSignInSecondFactor();
        return;
      }

      setErrorMessages(["We couldn't complete that sign-in yet. Please try again."]);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signUpsEnabled) {
      setErrorMessages(["New sign-ups are paused right now."]);
      return;
    }

    if (signUpPassword !== confirmPassword) {
      setErrorMessages(["Passwords do not match."]);
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);
    setVerificationNotice(null);
    captureAppEvent(posthog, "auth_sign_up_submitted", {
      redirectTarget
    });

    try {
      const { error } = await signUp.password({
        emailAddress: signUpEmail.trim(),
        password: signUpPassword
      });

      if (error) {
        throw error;
      }

      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }

      const verificationResult = await signUp.verifications.sendEmailCode();
      if (verificationResult.error) {
        throw verificationResult.error;
      }

      setVerificationStep("sign-up-code");
      setVerificationNotice(`We sent a verification code to ${signUpEmail.trim()}.`);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUpVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_verification_submitted", {
      flow: "sign_up_email_code"
    });

    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code: verificationCode.trim()
      });

      if (error) {
        throw error;
      }

      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }

      setErrorMessages([
        "Your account could not be verified yet. Try entering the latest code again."
      ]);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignInVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signInSecondFactor) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_verification_submitted", {
      flow: signInSecondFactor.strategy
    });

    try {
      const normalizedCode =
        signInSecondFactor.strategy === "backup_code"
          ? verificationCode.trim()
          : verificationCode.replace(/\D/g, "").trim();

      const { error } =
        signInSecondFactor.strategy === "totp"
          ? await signIn.mfa.verifyTOTP({ code: normalizedCode })
          : signInSecondFactor.strategy === "backup_code"
            ? await signIn.mfa.verifyBackupCode({ code: normalizedCode })
            : signInSecondFactor.strategy === "email_code"
              ? await signIn.mfa.verifyEmailCode({ code: normalizedCode })
              : await signIn.mfa.verifyPhoneCode({ code: normalizedCode });

      if (error) {
        throw error;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      setErrorMessages(["That verification code did not complete sign-in. Please try again."]);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendVerificationCode() {
    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_verification_resent", {
      flow: "sign_up_email_code"
    });

    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) {
        throw error;
      }

      setVerificationNotice(`A fresh verification code was sent to ${signUpEmail.trim()}.`);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendSignInVerificationCode() {
    if (!signInSecondFactor) {
      return;
    }

    if (signInSecondFactor.strategy === "totp") {
      setVerificationNotice("Open your authenticator app and enter the latest code.");
      return;
    }

    if (signInSecondFactor.strategy === "backup_code") {
      setVerificationNotice("Use one of your remaining backup codes to finish signing in.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_verification_resent", {
      flow: signInSecondFactor.strategy
    });

    try {
      const { error } =
        signInSecondFactor.strategy === "email_code"
          ? await signIn.mfa.sendEmailCode()
          : await signIn.mfa.sendPhoneCode();

      if (error) {
        throw error;
      }

      setVerificationNotice(
        `A fresh verification code was sent to ${signInSecondFactor.safeIdentifier ?? "your device"}.`
      );
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSignUpVerificationMode = mode === "sign-up" && verificationStep === "sign-up-code";
  const isSignInVerificationMode =
    mode === "sign-in" && verificationStep === "sign-in-second-factor";
  const isVerificationMode = isSignUpVerificationMode || isSignInVerificationMode;
  const verificationLabel =
    signInSecondFactor?.strategy === "totp"
      ? "Authenticator code"
      : signInSecondFactor?.strategy === "backup_code"
        ? "Backup code"
        : "Verification code";
  const verificationPlaceholder =
    signInSecondFactor?.strategy === "backup_code"
      ? "Enter a backup code"
      : "Enter the 6-digit code";
  const verificationButtonLabel = isSignInVerificationMode ? "Verify and log in" : "Verify email";
  const verificationBody = isSignInVerificationMode
    ? signInSecondFactor?.strategy === "totp"
      ? "Enter the latest code from your authenticator app to finish signing in."
      : signInSecondFactor?.strategy === "backup_code"
        ? "Use one of your recovery codes to finish signing in."
        : "Enter the latest verification code to finish signing in."
    : "Check your inbox and enter the latest code to finish creating your account.";
  const canAutoSubmitVerification =
    signInSecondFactor?.strategy !== "backup_code" || isSignUpVerificationMode;

  return (
    <div className="fixed inset-0 grid h-screen overflow-hidden bg-white dark:bg-[#171b1f] lg:grid-cols-[1fr_1fr]">
      {/* ── Left: form panel ── */}
      <div className="flex flex-col justify-between overflow-y-auto px-8 py-10 sm:px-12 lg:px-16 lg:py-12">
        <div>
          <div className="flex items-start justify-between gap-4">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-ocean text-white">
                <Hand className="hello-hand-wave h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
              </div>
              <div>
                <p className="editorial-display text-2xl font-semibold tracking-[-0.05em] text-[#16261f] dark:text-[#f2ede6]">
                  HelloBrand
                </p>
                <p className="text-[13px] text-muted-foreground">
                  Creator partnership operating system
                </p>
              </div>
            </Link>

            <div className="hidden text-sm text-muted-foreground sm:block">
              {mode === "sign-in" ? (
                <p>
                  Need an account?{" "}
                  {signUpsEnabled ? (
                    <button
                      type="button"
                      onClick={() => updateMode("sign-up")}
                      className="font-medium text-ocean underline underline-offset-4 dark:text-sand"
                    >
                      Sign up
                    </button>
                  ) : (
                    <span className="font-medium text-muted-foreground">Sign-ups are paused</span>
                  )}
                </p>
              ) : (
                <p>
                  Already have one?{" "}
                  <button
                    type="button"
                    onClick={() => updateMode("sign-in")}
                    className="font-medium text-ocean underline underline-offset-4 dark:text-sand"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-[420px] lg:mt-16">
            <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
              {isVerificationMode
                ? isSignInVerificationMode
                  ? "Verify your sign-in"
                  : "Verify your account"
                : mode === "sign-in"
                  ? "Log in to your account"
                  : "Create your account"}
            </p>
            <h1 className="mt-4 text-[2.25rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.5rem]">
              {isVerificationMode
                ? isSignInVerificationMode
                  ? "One more step"
                  : "Enter your verification code"
                : mode === "sign-in"
                  ? "Welcome back"
                  : "Set up your partnership workspace"}
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
              {isVerificationMode
                ? verificationBody
                : mode === "sign-in"
                  ? "Sign in with your email or username and password."
                  : signUpsEnabled
                    ? "Start with email and password. We’ll send a quick verification code after that."
                    : "New sign-ups are paused right now."}
            </p>

            {verificationNotice ? (
              <div className="mt-6 border border-ocean/15 bg-ocean/5 px-4 py-3 text-sm text-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-sand">
                {verificationNotice}
              </div>
            ) : null}

            {errorMessages.length > 0 ? (
              <div className="mt-6 border border-clay/20 bg-clay/8 px-4 py-3 text-sm text-clay dark:border-clay/25">
                {errorMessages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            ) : null}

            {mode === "sign-in" && verificationStep === "details" ? (
              <form className="mt-8 grid gap-5" onSubmit={handleSignIn}>
                <div className="grid gap-2">
                  <label htmlFor="sign-in-email" className="text-sm font-medium text-foreground">
                    Email or username
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sign-in-email"
                      type="text"
                      autoComplete="username"
                      value={signInEmail}
                      onChange={(event) => setSignInEmail(event.currentTarget.value)}
                      className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                      placeholder="Enter your email or username"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="sign-in-password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sign-in-password"
                      type="password"
                      autoComplete="current-password"
                      value={signInPassword}
                      onChange={(event) => setSignInPassword(event.currentTarget.value)}
                      className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || signInFetchStatus === "fetching"}
                  className="mt-2 h-12 rounded-xl bg-ocean text-white hover:bg-ocean/90"
                >
                  {isSubmitting || signInFetchStatus === "fetching" ? "Signing in..." : "Log in"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            ) : verificationStep === "details" ? (
              <form className="mt-8 grid gap-5" onSubmit={handleSignUp}>
                <div className="grid gap-2">
                  <label htmlFor="sign-up-email" className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sign-up-email"
                      type="email"
                      autoComplete="email"
                      value={signUpEmail}
                      onChange={(event) => setSignUpEmail(event.currentTarget.value)}
                      className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="sign-up-password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sign-up-password"
                      type="password"
                      autoComplete="new-password"
                      value={signUpPassword}
                      onChange={(event) => setSignUpPassword(event.currentTarget.value)}
                      className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                      placeholder="Create a password"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                    Confirm password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                      className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                      placeholder="Repeat your password"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || signUpFetchStatus === "fetching"}
                  className="mt-2 h-12 rounded-xl bg-ocean text-white hover:bg-ocean/90"
                >
                  {isSubmitting || signUpFetchStatus === "fetching"
                    ? "Creating account..."
                    : "Create account"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div id="clerk-captcha" />
              </form>
            ) : (
              <form
                className="mt-8 grid gap-5"
                ref={verificationFormRef}
                onSubmit={(event) =>
                  isSignInVerificationMode
                    ? handleSignInVerification(event)
                    : handleSignUpVerification(event)
                }
              >
                <div className="grid gap-2">
                  <label htmlFor="verification-code" className="text-sm font-medium text-foreground">
                    {verificationLabel}
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="verification-code"
                      type="text"
                      inputMode={signInSecondFactor?.strategy === "backup_code" ? "text" : "numeric"}
                      autoComplete={
                        signInSecondFactor?.strategy === "backup_code" ? "off" : "one-time-code"
                      }
                      maxLength={signInSecondFactor?.strategy === "backup_code" ? undefined : 6}
                      value={verificationCode}
                      onChange={(event) => {
                        const value =
                          signInSecondFactor?.strategy === "backup_code"
                            ? event.currentTarget.value.replace(/\s/g, "").slice(0, 32)
                            : event.currentTarget.value.replace(/\D/g, "").slice(0, 6);
                        setVerificationCode(value);
                        if (canAutoSubmitVerification && value.length === 6) {
                          setTimeout(() => verificationFormRef.current?.requestSubmit(), 0);
                        }
                      }}
                      className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                      placeholder={verificationPlaceholder}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    isSubmitting ||
                    (isSignInVerificationMode
                      ? signInFetchStatus === "fetching"
                      : signUpFetchStatus === "fetching")
                  }
                  className="mt-2 h-12 rounded-xl bg-ocean text-white hover:bg-ocean/90"
                >
                  {isSubmitting ? "Verifying..." : verificationButtonLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      resetVerificationState();
                    }}
                    className="font-medium text-black/60 underline underline-offset-4 transition hover:text-black dark:text-white/60 dark:hover:text-white"
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void (isSignInVerificationMode
                        ? resendSignInVerificationCode()
                        : resendVerificationCode())
                    }
                    disabled={isSubmitting}
                    className="font-medium text-black/60 underline underline-offset-4 transition hover:text-black disabled:opacity-50 dark:text-white/60 dark:hover:text-white"
                  >
                    {isSignInVerificationMode &&
                    signInSecondFactor &&
                    (signInSecondFactor.strategy === "totp" ||
                      signInSecondFactor.strategy === "backup_code")
                      ? "Need help?"
                      : "Resend code"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 text-sm text-muted-foreground sm:hidden">
          {mode === "sign-in" ? (
            <p>
              Need an account?{" "}
              {signUpsEnabled ? (
                <button
                  type="button"
                  onClick={() => updateMode("sign-up")}
                  className="font-medium text-ocean underline underline-offset-4 dark:text-sand"
                >
                  Sign up
                </button>
              ) : (
                <span className="font-medium text-muted-foreground">Sign-ups are paused</span>
              )}
            </p>
          ) : (
            <p>
              Already have one?{" "}
              <button
                type="button"
                onClick={() => updateMode("sign-in")}
                className="font-medium text-ocean underline underline-offset-4 dark:text-sand"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ── Right: marketing panel ── */}
      <div className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#16503f_0%,#15553f_42%,#184f3e_72%,#275447_100%)] lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="absolute right-[-12%] top-[-10%] h-[380px] w-[380px] rounded-full border border-white/[0.06]" />
        <div className="absolute bottom-[-15%] left-[-10%] h-[440px] w-[440px] rounded-full border border-white/[0.06]" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-12 text-white">
          <div />

          <div className="max-w-[440px]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              Your partnerships, organized
            </p>
            <h2 className="mt-4 text-[2.6rem] font-semibold leading-[1.06] tracking-[-0.04em] xl:text-[3rem]">
              Stop digging through emails for deal details.
            </h2>
            <p className="mt-4 max-w-[380px] text-[15px] leading-7 text-white/65">
              Upload a contract or connect your inbox. HelloBrand pulls out the terms, deadlines, and
              payments so you don&apos;t have to.
            </p>

            <div className="mt-7 grid gap-2.5">
              {rightPanelHighlights.map((highlight) => (
                <div
                  key={highlight}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.06] px-4 py-3 backdrop-blur-sm"
                >
                  <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-white/50" />
                  <p className="text-sm text-white/80">{highlight}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-10">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.05] p-4 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Extracted
              </p>
              <p className="mt-3 text-[17px] font-semibold text-white">$4,200</p>
              <p className="mt-1 text-[11px] leading-4 text-white/45">
                Net 30, 60-day exclusivity, skincare only
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.05] p-4 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Flagged
              </p>
              <p className="mt-3 text-[17px] font-semibold text-[#E5A87B]">2 risks</p>
              <p className="mt-1 text-[11px] leading-4 text-white/45">
                Perpetual usage clause, invoice 12 days overdue
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.05] p-4 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Next up
              </p>
              <p className="mt-3 text-[17px] font-semibold text-white">Mar 28</p>
              <p className="mt-1 text-[11px] leading-4 text-white/45">
                Reels draft due, Glossier spring campaign
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
