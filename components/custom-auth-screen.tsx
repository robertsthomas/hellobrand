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
    <div className="relative min-h-screen overflow-hidden bg-[#dddee2] px-4 py-6 dark:bg-[#101419] sm:px-6 sm:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(26,77,62,0.08),transparent_26%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(127,188,165,0.10),transparent_22%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1420px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_32px_90px_rgba(41,39,34,0.10)] dark:border-white/10 dark:bg-[#171b1f] dark:shadow-[0_34px_90px_rgba(0,0,0,0.34)] lg:grid-cols-[minmax(0,0.92fr)_minmax(460px,0.98fr)]">
          <div className="flex flex-col justify-between p-8 sm:p-10 lg:p-16">
            <div>
              <div className="flex items-start justify-between gap-4">
                <Link href="/" className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ocean text-white shadow-[0_16px_32px_rgba(26,77,62,0.16)]">
                    <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
                  </div>
                  <span className="editorial-display text-[2rem] font-semibold tracking-[-0.05em] text-[#16261f] dark:text-[#f2ede6]">
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

              <div className="mt-14 max-w-[410px]">
                <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                  {isVerificationMode ? "Verify your account" : mode === "sign-in" ? "Log in to your account" : "Create your account"}
                </p>
                <h1 className="mt-4 text-[2.5rem] font-semibold tracking-[-0.05em] text-foreground">
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
              </div>
              {verificationNotice ? (
                <div className="mt-8 border border-ocean/15 bg-ocean/5 px-4 py-3 text-sm text-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-sand">
                  {verificationNotice}
                </div>
              ) : null}

              {errorMessages.length > 0 ? (
                <div className="mt-8 border border-clay/20 bg-clay/8 px-4 py-3 text-sm text-clay dark:border-clay/25">
                  {errorMessages.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              ) : null}

              {mode === "sign-in" ? (
                <form className="mt-8 grid gap-4" onSubmit={handleSignIn}>
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
                        className="h-12 rounded-2xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
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
                        className="h-12 rounded-2xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={!isSignInLoaded || isSubmitting}
                    className="mt-3 h-12 rounded-2xl bg-ocean text-white hover:bg-ocean/95"
                  >
                    {isSubmitting ? "Signing in..." : "Log in"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              ) : verificationStep === "details" ? (
                <form className="mt-8 grid gap-4" onSubmit={handleSignUp}>
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
                        className="h-12 rounded-2xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
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
                        className="h-12 rounded-2xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
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
                        className="h-12 rounded-2xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                        placeholder="Repeat your password"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={!isSignUpLoaded || isSubmitting}
                    className="mt-3 h-12 rounded-2xl bg-ocean text-white hover:bg-ocean/95"
                  >
                    {isSubmitting ? "Creating account..." : "Create account"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <form className="mt-8 grid gap-4" onSubmit={handleVerification}>
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
                        className="h-12 rounded-2xl border-black/10 bg-white pl-11 pr-4 shadow-none dark:border-white/12 dark:bg-white/[0.03]"
                        placeholder="Enter the code"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={!isSignUpLoaded || isSubmitting}
                    className="mt-3 h-12 rounded-2xl bg-ocean text-white hover:bg-ocean/95"
                  >
                    {isSubmitting ? "Verifying..." : "Verify email"}
                    <ArrowRight className="h-4 w-4" />
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
              <div className="mt-3">
                <Link
                  href="/"
                  className="font-medium text-black/60 underline underline-offset-4 hover:text-black dark:text-white/60 dark:hover:text-white"
                >
                  Back to site
                </Link>
              </div>
            </div>
          </div>

          <div className="relative hidden min-h-[760px] overflow-hidden bg-[linear-gradient(160deg,#16503f_0%,#15553f_42%,#184f3e_72%,#275447_100%)] lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_92%,rgba(255,122,89,0.34),transparent_26%),radial-gradient(circle_at_18%_88%,rgba(83,208,128,0.16),transparent_26%),radial-gradient(circle_at_40%_20%,rgba(255,255,255,0.08),transparent_24%)]" />
            <div className="absolute right-[-14%] top-[-8%] h-[360px] w-[360px] rounded-full border border-white/8 bg-white/5 blur-[1px]" />
            <div className="absolute left-[-14%] bottom-[-18%] h-[420px] w-[420px] rounded-full border border-white/8 bg-white/5 blur-[1px]" />

            <div className="relative flex h-full flex-col justify-between p-10 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
                  <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
                </div>
                <div>
                  <p className="editorial-display text-[1.75rem] font-semibold tracking-[-0.05em]">
                    HelloBrand
                  </p>
                  <p className="text-sm text-white/72">Creator partnership operating system</p>
                </div>
              </div>

              <div className="max-w-[420px]">
                <p className="text-[12px] uppercase tracking-[0.18em] text-white/58">
                  Private Workspace
                </p>
                <h2 className="mt-5 text-[3rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
                  Keep every brand conversation in one calm place.
                </h2>
                <p className="mt-5 max-w-[360px] text-[16px] leading-8 text-white/74">
                  Review contracts, sync email threads, and generate workspaces without
                  bouncing between tools.
                </p>

                <div className="mt-8 grid gap-3">
                  {rightPanelHighlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-center gap-3 border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/14">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <p className="text-sm text-white/84">{highlight}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative h-[290px]">
                <div className="absolute left-6 top-12 w-[250px] rotate-[-7deg] border border-white/12 bg-[#f7f3ee] p-4 text-[#233127] shadow-[0_26px_70px_rgba(7,21,16,0.28)]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b695f]">
                      New workspace
                    </p>
                    <span className="rounded-full bg-[#dfeadf] px-2 py-1 text-[10px] font-medium text-[#2b5a44]">
                      AI Ready
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-[#16261f]">
                    Summer launch collaboration
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#5b695f]">
                    Contract, email thread, usage rights, and deliverables grouped together.
                  </p>
                  <div className="mt-5 grid gap-2">
                    <div className="h-2 w-full bg-[#d7ddd8]" />
                    <div className="h-2 w-4/5 bg-[#d7ddd8]" />
                    <div className="h-2 w-3/5 bg-[#d7ddd8]" />
                  </div>
                </div>

                <div className="absolute bottom-0 right-0 w-[320px] rotate-[10deg] border border-white/12 bg-white/95 p-5 text-[#1d2430] shadow-[0_32px_90px_rgba(7,21,16,0.32)]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#69707d]">
                      Inbox context
                    </p>
                    <span className="text-[10px] font-medium text-[#1a4d3e]">Linked</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div className="border border-black/6 px-3 py-3">
                      <p className="text-sm font-semibold">Campaign brief</p>
                      <p className="mt-1 text-xs text-[#69707d]">
                        Summary generated and ready to review.
                      </p>
                    </div>
                    <div className="border border-black/6 px-3 py-3">
                      <p className="text-sm font-semibold">Negotiation draft</p>
                      <p className="mt-1 text-xs text-[#69707d]">
                        Payment terms and usage revisions suggested.
                      </p>
                    </div>
                    <div className="border border-black/6 px-3 py-3">
                      <p className="text-sm font-semibold">Next deliverable</p>
                      <p className="mt-1 text-xs text-[#69707d]">
                        Approval deadline tracked inside the workspace.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
