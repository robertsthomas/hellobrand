"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { trackPublicFunnelEvent } from "@/lib/public-funnel-events";

type ClaimErrorState = {
  title: string;
  message: string;
  href?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function PublicClaimLoader() {
  const [errorState, setErrorState] = useState<ClaimErrorState | null>(null);

  useEffect(() => {
    trackPublicFunnelEvent("anonymous_auth_returned");

    void (async () => {
      try {
        const response = await fetch("/api/public/intake/claim", {
          method: "POST"
        });
        const payload = await response.json();

        if (!response.ok) {
          setErrorState({
            title:
              typeof payload.title === "string"
                ? payload.title
                : "We couldn’t finish creating your free workspace.",
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Could not save this contract.",
            href: typeof payload.href === "string" ? payload.href : undefined,
            ctaLabel: typeof payload.ctaLabel === "string" ? payload.ctaLabel : undefined,
            secondaryHref:
              typeof payload.secondaryHref === "string" ? payload.secondaryHref : undefined,
            secondaryLabel:
              typeof payload.secondaryLabel === "string" ? payload.secondaryLabel : undefined
          });
          return;
        }

        window.location.replace(payload.href as string);
      } catch (error) {
        setErrorState({
          title: "We couldn’t finish creating your free workspace.",
          message:
            error instanceof Error ? error.message : "Could not save this contract.",
          href: "/upload",
          ctaLabel: "Upload again"
        });
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfaf7] px-5 py-12 dark:bg-[#0f1115]">
      <div className="w-full max-w-xl border border-black/8 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        {errorState ? (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              {errorState.title}
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{errorState.message}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {errorState.href && errorState.ctaLabel ? (
                <Link
                  href={errorState.href}
                  className="inline-flex h-11 items-center justify-center bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/92"
                >
                  {errorState.ctaLabel}
                </Link>
              ) : null}
              {errorState.secondaryHref && errorState.secondaryLabel ? (
                <Link
                  href={errorState.secondaryHref}
                  className="inline-flex h-11 items-center justify-center border border-black/8 bg-white px-5 text-sm font-semibold text-foreground transition hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]"
                >
                  {errorState.secondaryLabel}
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Creating your free workspace...
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              We&apos;re saving the preview into a real HelloBrand workspace so you can track
              deliverables, payments, and follow-up from here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
