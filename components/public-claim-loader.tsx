"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { trackPublicFunnelEvent } from "@/lib/public-funnel-events";
import { ANONYMOUS_ANALYSIS_TOKEN_STORAGE_KEY } from "@/lib/public-upload-session";

export function PublicClaimLoader() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = window.sessionStorage.getItem(ANONYMOUS_ANALYSIS_TOKEN_STORAGE_KEY);

    if (!token) {
      setErrorMessage("We could not find your uploaded contract. Start again from upload.");
      return;
    }

    trackPublicFunnelEvent("anonymous_auth_returned");

    void (async () => {
      try {
        const response = await fetch("/api/public/intake/claim", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            analysisToken: token
          })
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not save this contract.");
        }

        window.sessionStorage.removeItem(ANONYMOUS_ANALYSIS_TOKEN_STORAGE_KEY);
        window.location.replace(payload.href as string);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not save this contract."
        );
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfaf7] px-5 py-12 dark:bg-[#0f1115]">
      <div className="w-full max-w-xl border border-black/8 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        {errorMessage ? (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              We couldn&apos;t finish saving that contract.
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
            <div className="mt-6">
              <Link
                href="/upload"
                className="inline-flex h-11 items-center justify-center bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/92"
              >
                Upload another contract
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Saving your contract to the workspace...
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              We&apos;re turning the anonymous breakdown into a real deal page so you can
              track deliverables, payments, and follow-up from here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
