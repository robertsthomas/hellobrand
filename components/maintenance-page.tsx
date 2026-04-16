"use client";

import { ArrowRight, Check, Hand, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { joinWaitlist } from "@/app/server-actions/waitlist-actions";

export function MaintenancePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMsg("");

    const result = await joinWaitlist(email);

    if (result.success) {
      setStatus("success");
    } else {
      setErrorMsg(result.error ?? "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-primary text-[#1a2634]">
      <main className="flex min-h-[100dvh] items-stretch sm:items-center sm:justify-center sm:px-6 sm:py-12 lg:px-8">
        <div className="flex w-full flex-1 flex-col justify-center bg-white sm:max-w-3xl sm:flex-initial sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl">
          <div className="px-6 pb-10 pt-8 sm:px-12 sm:pb-14 sm:pt-10">
            {/* Logo */}
            <div className="group flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center bg-primary text-white">
                <Hand className="hello-hand-wave h-4 w-4 rotate-[18deg]" strokeWidth={2.15} />
              </div>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#1a2634]">
                HelloBrand
              </span>
            </div>

            {/* Coming soon label */}
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Coming Soon
            </p>

            {/* Heading */}
            <h1 className="mt-4 max-w-[16ch] text-[2.4rem] font-bold leading-[1] tracking-[-0.04em] text-[#1a2634] sm:text-[3.2rem]">
              Something new is on the way.
            </h1>

            {/* Description */}
            <p className="mt-5 max-w-[38ch] text-[1rem] leading-relaxed text-[#5d6876]">
              We're building the operating layer for creator partnerships. Join the waitlist and be
              the first to know when we launch.
            </p>

            {/* Waitlist form */}
            {status === "success" ? (
              <div className="mt-8 flex items-center gap-2 text-[15px] font-medium text-primary">
                <Check className="h-4 w-4" />
                You're on the list. We'll be in touch.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 flex max-w-md gap-0">
                <input
                  type="email"
                  required
                  suppressHydrationWarning
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  aria-label="Email address"
                  className="h-12 flex-1 border border-r-0 border-black/10 bg-[#fafaf8] px-4 text-[15px] text-[#1a2634] placeholder:text-black/35 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap bg-primary px-6 text-[15px] font-semibold text-white transition hover:bg-primary/92 disabled:opacity-70"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Join waitlist
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
            {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
