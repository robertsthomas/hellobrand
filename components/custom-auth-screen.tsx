"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Hand, LockKeyhole, Mail } from "lucide-react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "sign-in" | "sign-up";
type VerificationStep = "details" | "code";

const rightPanelHighlights = [
  "Plain-English contract summaries",
  "Inbox threads linked to live partnerships",
  "One workspace for every brand relationship"
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
  const { setActive } = useClerk();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();

  const queryMode = useMemo(() => deriveMode(searchParams.get("mode")), [searchParams]);

  const [mode, setMode] = useState<AuthMode>(queryMode);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("details");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  useEffect(() => {
    setMode(queryMode);
  }, [queryMode]);

  useEffect(() => {
    setErrorMessages([]);
    setIsSubmitting(false);
  }, [mode, verificationStep]);

  function updateMode(nextMode: AuthMode) {
    setMode(nextMode);
    setVerificationStep("details");
    setVerificationCode("");
    setVerificationNotice(null);
    setErrorMessages([]);
    router.replace(nextMode === "sign-up" ? "/login?mode=sign-up" : "/login", {
      scroll: false
    });
  }

  async function activateSession(sessionId: string) {
    await setActive({ session: sessionId });
    router.push("/app");
    router.refresh();
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSignInLoaded || !signIn) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);

    try {
      const result = await signIn.create({
        identifier: signInEmail.trim(),
        password: signInPassword
      });

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId);
        return;
      }

      setErrorMessages([
        "This sign-in needs an additional verification step that is not configured in this screen yet."
      ]);
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
      setVerificationStep("code");
      setVerificationNotice(`We sent a verification code to ${signUpEmail.trim()}.`);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSignUpLoaded || !signUp) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);

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

  async function resendVerificationCode() {
    if (!isSignUpLoaded || !signUp) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessages([]);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerificationNotice(`A fresh verification code was sent to ${signUpEmail.trim()}.`);
    } catch (error) {
      setErrorMessages(getErrorMessages(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isVerificationMode = mode === "sign-up" && verificationStep === "code";

  return (
    <div className="fixed inset-0 grid h-screen overflow-hidden bg-white dark:bg-[#171b1f] lg:grid-cols-[1fr_1fr]">
      {/* ── Left: form panel ── */}
      <div className="flex flex-col justify-between overflow-y-auto px-8 py-10 sm:px-12 lg:px-16 lg:py-12">
        <div>
          <div className="flex items-start justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean text-white">
                <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
              </div>
              <span className="editorial-display text-2xl font-semibold tracking-[-0.05em] text-[#16261f] dark:text-[#f2ede6]">
                HelloBrand
              </span>
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
              {isVerificationMode ? "Verify your account" : mode === "sign-in" ? "Log in to your account" : "Create your account"}
            </p>
            <h1 className="mt-4 text-[2.25rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.5rem]">
              {isVerificationMode
                ? "Enter your verification code"
                : mode === "sign-in"
                  ? "Welcome back"
                  : "Set up your partnership workspace"}
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
              {isVerificationMode
                ? "Check your inbox and enter the latest code to finish creating your account."
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

            {mode === "sign-in" ? (
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
              </form>
            ) : (
              <form className="mt-8 grid gap-5" onSubmit={handleVerification}>
                <div className="grid gap-2">
                  <label htmlFor="verification-code" className="text-sm font-medium text-foreground">
                    Verification code
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="verification-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.currentTarget.value)}
                      className="h-12 rounded-xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                      placeholder="Enter the code"
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
                  {isSubmitting ? "Verifying..." : "Verify email"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationStep("details");
                      setVerificationCode("");
                      setVerificationNotice(null);
                    }}
                    className="font-medium text-black/60 underline underline-offset-4 transition hover:text-black dark:text-white/60 dark:hover:text-white"
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    onClick={() => void resendVerificationCode()}
                    disabled={isSubmitting}
                    className="font-medium text-black/60 underline underline-offset-4 transition hover:text-black disabled:opacity-50 dark:text-white/60 dark:hover:text-white"
                  >
                    Resend code
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
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
            </div>
            <div>
              <p className="editorial-display text-[1.6rem] font-semibold tracking-[-0.05em]">
                HelloBrand
              </p>
              <p className="text-[13px] text-white/60">Creator partnership operating system</p>
            </div>
          </div>

          <div className="max-w-[440px]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              Private Workspace
            </p>
            <h2 className="mt-4 text-[2.6rem] font-semibold leading-[1.06] tracking-[-0.04em] xl:text-[3rem]">
              Keep every brand conversation in one calm place.
            </h2>
            <p className="mt-4 max-w-[380px] text-[15px] leading-7 text-white/65">
              Review contracts, sync email threads, and generate workspaces without
              bouncing between tools.
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
            <div className="absolute left-4 top-8 w-[240px] rotate-[-6deg] rounded-lg border border-white/10 bg-[#f7f3ee] p-4 text-[#233127] shadow-[0_20px_60px_rgba(7,21,16,0.30)]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5b695f]">
                  New workspace
                </p>
                <span className="rounded-full bg-[#dfeadf] px-2 py-0.5 text-[9px] font-medium text-[#2b5a44]">
                  AI Ready
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-[#16261f]">
                Summer launch collaboration
              </p>
              <p className="mt-1.5 text-xs leading-5 text-[#5b695f]">
                Contract, email thread, usage rights, and deliverables grouped together.
              </p>
            </div>

            <div className="absolute bottom-0 right-0 w-[280px] rotate-[8deg] rounded-lg border border-white/10 bg-white/95 p-4 text-[#1d2430] shadow-[0_24px_70px_rgba(7,21,16,0.35)]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#69707d]">
                  Inbox context
                </p>
                <span className="text-[10px] font-medium text-[#1a4d3e]">Linked</span>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="rounded border border-black/[0.04] px-3 py-2.5">
                  <p className="text-[13px] font-semibold">Campaign brief</p>
                  <p className="mt-0.5 text-[11px] text-[#69707d]">
                    Summary generated and ready to review.
                  </p>
                </div>
                <div className="rounded border border-black/[0.04] px-3 py-2.5">
                  <p className="text-[13px] font-semibold">Negotiation draft</p>
                  <p className="mt-0.5 text-[11px] text-[#69707d]">
                    Payment terms and usage revisions suggested.
                  </p>
                </div>
                <div className="rounded border border-black/[0.04] px-3 py-2.5">
                  <p className="text-[13px] font-semibold">Next deliverable</p>
                  <p className="mt-0.5 text-[11px] text-[#69707d]">
                    Approval deadline tracked inside the workspace.
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
