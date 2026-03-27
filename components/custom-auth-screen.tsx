"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Hand, LockKeyhole, Mail } from "lucide-react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
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
      safeIdentifier: string;
      emailAddressId: string;
    }
  | {
      strategy: "email_link";
      safeIdentifier: string;
      emailAddressId: string;
    }
  | {
      strategy: "phone_code";
      safeIdentifier: string;
      phoneNumberId?: string;
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

export function CustomAuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const { setActive } = useClerk();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();

  const queryMode = useMemo(() => deriveMode(searchParams.get("mode")), [searchParams]);
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
    if (
      verificationStep === "sign-in-second-factor" &&
      isSignInLoaded &&
      signIn?.status === "complete" &&
      signIn.createdSessionId
    ) {
      void activateSession(signIn.createdSessionId);
    }
  }, [isSignInLoaded, signIn, verificationStep]);

  useEffect(() => {
    setErrorMessages([]);
    setIsSubmitting(false);
  }, [mode, verificationStep]);

  function updateMode(nextMode: AuthMode) {
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

  async function activateSession(sessionId: string) {
    await setActive({ session: sessionId });
    router.push(redirectTarget);
    router.refresh();
  }

  async function moveToSignInSecondFactor(result: NonNullable<typeof signIn>) {
    const supportedSecondFactors = result.supportedSecondFactors ?? [];
    const preferredSecondFactor =
      supportedSecondFactors.find((factor) => factor.strategy === "totp") ??
      supportedSecondFactors.find((factor) => factor.strategy === "email_code") ??
      supportedSecondFactors.find((factor) => factor.strategy === "email_link") ??
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
      if (!preferredSecondFactor.emailAddressId) {
        setErrorMessages([
          "Your account requires email verification, but the email destination could not be loaded."
        ]);
        return;
      }

      await result.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: preferredSecondFactor.emailAddressId
      });
      setSignInSecondFactor({
        strategy: "email_code",
        safeIdentifier: preferredSecondFactor.safeIdentifier,
        emailAddressId: preferredSecondFactor.emailAddressId
      });
      setVerificationStep("sign-in-second-factor");
      setVerificationNotice(
        `We sent a verification code to ${preferredSecondFactor.safeIdentifier}.`
      );
      return;
    }

    if (preferredSecondFactor.strategy === "email_link") {
      if (!preferredSecondFactor.emailAddressId) {
        setErrorMessages([
          "Your account requires email verification, but the email destination could not be loaded."
        ]);
        return;
      }

        await result.prepareSecondFactor({
          strategy: "email_link",
          redirectUrl:
            typeof window === "undefined"
              ? `/login?mode=sign-in&redirect=${encodeURIComponent(redirectTarget)}`
              : `${window.location.origin}/login?mode=sign-in&redirect=${encodeURIComponent(
                  redirectTarget
                )}`,
          emailAddressId: preferredSecondFactor.emailAddressId
        });
      setSignInSecondFactor({
        strategy: "email_link",
        safeIdentifier: preferredSecondFactor.safeIdentifier,
        emailAddressId: preferredSecondFactor.emailAddressId
      });
      setVerificationStep("sign-in-second-factor");
      setVerificationNotice(
        `We sent a secure sign-in link to ${preferredSecondFactor.safeIdentifier}. Open that email to finish signing in.`
      );
      return;
    }

    if (!preferredSecondFactor.phoneNumberId) {
      setErrorMessages([
        "Your account requires SMS verification, but the phone destination could not be loaded."
      ]);
      return;
    }

    await result.prepareSecondFactor({
      strategy: "phone_code",
      phoneNumberId: preferredSecondFactor.phoneNumberId
    });
    setSignInSecondFactor({
      strategy: "phone_code",
      safeIdentifier: preferredSecondFactor.safeIdentifier,
      phoneNumberId: preferredSecondFactor.phoneNumberId
    });
    setVerificationStep("sign-in-second-factor");
    setVerificationNotice(
      `We sent a verification code to ${preferredSecondFactor.safeIdentifier}.`
    );
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSignInLoaded || !signIn) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_sign_in_submitted", {
      redirectTarget
    });

    try {
      const result = await signIn.create({
        identifier: signInEmail.trim(),
        password: signInPassword
      });

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId);
        return;
      }

      if (result.status === "needs_second_factor") {
        setVerificationCode("");
        await moveToSignInSecondFactor(result);
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

    if (!isSignUpLoaded || !signUp) {
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
      const result = await signUp.create({
        emailAddress: signUpEmail.trim(),
        password: signUpPassword
      });

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId);
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
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

    if (!isSignUpLoaded || !signUp) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_verification_submitted", {
      flow: "sign_up_email_code"
    });

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim()
      });

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId);
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

    if (!isSignInLoaded || !signIn || !signInSecondFactor) {
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

      const result =
        signInSecondFactor.strategy === "totp"
          ? await signIn.attemptSecondFactor({ strategy: "totp", code: normalizedCode })
          : signInSecondFactor.strategy === "backup_code"
            ? await signIn.attemptSecondFactor({
                strategy: "backup_code",
                code: normalizedCode
              })
            : signInSecondFactor.strategy === "email_code"
              ? await signIn.attemptSecondFactor({
                  strategy: "email_code",
                  code: normalizedCode
                })
              : await signIn.attemptSecondFactor({
                  strategy: "phone_code",
                  code: normalizedCode
                });

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId);
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
    if (!isSignUpLoaded || !signUp) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);
    captureAppEvent(posthog, "auth_verification_resent", {
      flow: "sign_up_email_code"
    });

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerificationNotice(`A fresh verification code was sent to ${signUpEmail.trim()}.`);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendSignInVerificationCode() {
    if (!isSignInLoaded || !signIn || !signInSecondFactor) {
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
      if (signInSecondFactor.strategy === "email_code") {
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: signInSecondFactor.emailAddressId
        });
      } else if (signInSecondFactor.strategy === "email_link") {
        await signIn.prepareSecondFactor({
          strategy: "email_link",
          redirectUrl:
            typeof window === "undefined"
              ? `/login?mode=sign-in&redirect=${encodeURIComponent(redirectTarget)}`
              : `${window.location.origin}/login?mode=sign-in&redirect=${encodeURIComponent(
                  redirectTarget
                )}`,
          emailAddressId: signInSecondFactor.emailAddressId
        });
      } else if (signInSecondFactor.strategy === "phone_code") {
        if (!signInSecondFactor.phoneNumberId) {
          throw new Error(
            "Your account requires SMS verification, but the phone destination could not be loaded."
          );
        }

        await signIn.prepareSecondFactor({
          strategy: "phone_code",
          phoneNumberId: signInSecondFactor.phoneNumberId
        });
      }

      setVerificationNotice(
        signInSecondFactor.strategy === "email_link"
          ? `A fresh sign-in link was sent to ${signInSecondFactor.safeIdentifier}.`
          : `A fresh verification code was sent to ${signInSecondFactor.safeIdentifier}.`
      );
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkSignInEmailLinkVerification() {
    if (!isSignInLoaded || !signIn || signInSecondFactor?.strategy !== "email_link") {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);

    try {
      const refreshed = await signIn.reload();

      if (refreshed.status === "complete" && refreshed.createdSessionId) {
        await activateSession(refreshed.createdSessionId);
        return;
      }

      setVerificationNotice(
        `We still need you to open the sign-in link sent to ${signInSecondFactor.safeIdentifier}.`
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
      : signInSecondFactor?.strategy === "email_link"
        ? "Email verification link"
      : signInSecondFactor?.strategy === "backup_code"
        ? "Backup code"
        : "Verification code";
  const verificationPlaceholder =
    signInSecondFactor?.strategy === "email_link"
      ? "Check your inbox for the sign-in link"
      : signInSecondFactor?.strategy === "backup_code"
      ? "Enter a backup code"
      : "Enter the 6-digit code";
  const verificationButtonLabel =
    isSignInVerificationMode && signInSecondFactor?.strategy === "email_link"
      ? "I've clicked the email link"
      : isSignInVerificationMode
        ? "Verify and log in"
        : "Verify email";
  const verificationBody = isSignInVerificationMode
    ? signInSecondFactor?.strategy === "totp"
      ? "Enter the latest code from your authenticator app to finish signing in."
      : signInSecondFactor?.strategy === "email_link"
        ? "Open the secure sign-in link from your email to finish signing in."
      : signInSecondFactor?.strategy === "backup_code"
        ? "Use one of your recovery codes to finish signing in."
        : "Enter the latest verification code to finish signing in."
    : "Check your inbox and enter the latest code to finish creating your account.";
  const canAutoSubmitVerification =
    (signInSecondFactor?.strategy !== "backup_code" &&
      signInSecondFactor?.strategy !== "email_link") ||
    isSignUpVerificationMode;

  return (
    <div className="fixed inset-0 grid h-screen overflow-hidden bg-white dark:bg-[#171b1f] lg:grid-cols-[1fr_1fr]">
      {/* ── Left: form panel ── */}
      <div className="flex flex-col justify-between overflow-y-auto px-8 py-10 sm:px-12 lg:px-16 lg:py-12">
        <div>
          <div className="flex items-start justify-between gap-4">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean text-white">
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
                  <button
                    type="button"
                    onClick={() => updateMode("sign-up")}
                    className="font-medium text-ocean underline underline-offset-4 dark:text-sand"
                  >
                    Sign up
                  </button>
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
                  : "Start with email and password. We’ll send a quick verification code after that."}
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
                  disabled={!isSignInLoaded || isSubmitting}
                  className="mt-2 h-12 rounded-xl bg-ocean text-white hover:bg-ocean/90"
                >
                  {isSubmitting ? "Signing in..." : "Log in"}
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
                  disabled={!isSignUpLoaded || isSubmitting}
                  className="mt-2 h-12 rounded-xl bg-ocean text-white hover:bg-ocean/90"
                >
                  {isSubmitting ? "Creating account..." : "Create account"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div id="clerk-captcha" />
              </form>
            ) : (
              <form
                className="mt-8 grid gap-5"
                ref={verificationFormRef}
                onSubmit={(event) => {
                  if (
                    isSignInVerificationMode &&
                    signInSecondFactor?.strategy === "email_link"
                  ) {
                    event.preventDefault();
                    void checkSignInEmailLinkVerification();
                    return;
                  }

                  return isSignInVerificationMode
                    ? handleSignInVerification(event)
                    : handleSignUpVerification(event);
                }}
              >
                {signInSecondFactor?.strategy === "email_link" && isSignInVerificationMode ? (
                  <div className="border border-black/10 bg-black/[0.02] px-4 py-4 text-sm text-muted-foreground dark:border-white/12 dark:bg-white/[0.03]">
                    We emailed a secure sign-in link to{" "}
                    <span className="font-medium text-foreground">
                      {signInSecondFactor.safeIdentifier}
                    </span>
                    . Open it in this browser, then come back here if you still need to continue.
                  </div>
                ) : (
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
                            // Auto-submit after a tick so React state is committed
                            setTimeout(() => verificationFormRef.current?.requestSubmit(), 0);
                          }
                        }}
                        className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                        placeholder={verificationPlaceholder}
                        required
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    isSubmitting ||
                    (isSignInVerificationMode ? !isSignInLoaded : !isSignUpLoaded)
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
              <button
                type="button"
                onClick={() => updateMode("sign-up")}
                className="font-medium text-ocean underline underline-offset-4 dark:text-sand"
              >
                Sign up
              </button>
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
              Upload a contract or connect your inbox. HelloBrand pulls out the terms, deadlines, and payments so you don&apos;t have to.
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

          <div className="relative h-[260px]">
            <div className="absolute left-4 top-8 w-[240px] rounded-lg border border-white/10 bg-[#f7f3ee] p-4 text-[#233127] shadow-[0_20px_60px_rgba(7,21,16,0.30)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5b695f]">
                Glossier · Spring campaign
              </p>
              <p className="mt-3 text-base font-semibold text-[#16261f]">
                $4,200 · Net 30
              </p>
              <p className="mt-1.5 text-xs leading-5 text-[#5b695f]">
                3 Instagram Reels, 1 TikTok. Exclusivity: 60 days, skincare only.
              </p>
            </div>

            <div className="absolute bottom-4 left-[35%] w-[220px] rounded-lg border border-white/10 bg-[#efe8dc] p-4 text-[#233127] shadow-[0_18px_52px_rgba(7,21,16,0.28)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6a7468]">
                Flagged
              </p>
              <div className="mt-3 grid gap-2">
                <div className="rounded border border-black/[0.05] px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-amber-700">Perpetual usage</p>
                  <p className="mt-0.5 text-[11px] text-[#6a7468]">
                    Contract says &quot;in perpetuity,&quot; brief says 6 months.
                  </p>
                </div>
                <div className="rounded border border-black/[0.05] px-3 py-2.5">
                  <p className="text-[13px] font-semibold">Late payment</p>
                  <p className="mt-0.5 text-[11px] text-[#6a7468]">
                    Invoice is 12 days past due.
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 right-0 w-[260px] rounded-lg border border-white/10 bg-white/95 p-4 text-[#1d2430] shadow-[0_24px_70px_rgba(7,21,16,0.35)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#69707d]">
                Next up
              </p>
              <div className="mt-3 grid gap-2">
                <div className="rounded border border-black/[0.04] px-3 py-2.5">
                  <p className="text-[13px] font-semibold">Reels draft due Mar 28</p>
                  <p className="mt-0.5 text-[11px] text-[#69707d]">
                    First cut for Glossier spring campaign.
                  </p>
                </div>
                <div className="rounded border border-black/[0.04] px-3 py-2.5">
                  <p className="text-[13px] font-semibold">Reply to Nike by Thu</p>
                  <p className="mt-0.5 text-[11px] text-[#69707d]">
                    Marcus asked about the revised exclusivity window.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
