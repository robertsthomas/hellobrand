"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileUp, Loader2, LockKeyhole, ShieldAlert, Sparkles } from "lucide-react";

import { PublicContractBreakdown } from "@/components/public-contract-breakdown";
import { ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES } from "@/lib/public-upload-config";
import { trackPublicFunnelEvent } from "@/lib/public-funnel-events";
import { ANONYMOUS_ANALYSIS_TOKEN_STORAGE_KEY } from "@/lib/public-upload-session";
import type { AnonymousDealBreakdown } from "@/lib/types";

type UploadState = "idle" | "uploading" | "done";
type UploadLimitGate = {
  message: string;
  signUpHref: string;
  signInHref: string;
};

const PROCESSING_STEPS = [
  "Extracting key clauses",
  "Summarizing creator terms",
  "Flagging watchouts"
] as const;

function buildAuthHref(mode: "sign-in" | "sign-up", redirectTo: string) {
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("redirect", redirectTo);
  return `/login?${params.toString()}`;
}

export function PublicUploadWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisToken, setAnalysisToken] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<AnonymousDealBreakdown | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [uploadLimitGate, setUploadLimitGate] = useState<UploadLimitGate | null>(null);

  const canSubmit = Boolean(selectedFile) && uploadState !== "uploading";
  const processingLabel = uploadState === "uploading" ? PROCESSING_STEPS : null;

  async function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (uploadState === "uploading") {
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Choose a document file first.");
      return;
    }

    if (selectedFile.size > ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES) {
      setErrorMessage("Please upload a document smaller than 10 MB.");
      return;
    }

    setUploadState("uploading");
    setErrorMessage(null);
    setUploadLimitGate(null);
    trackPublicFunnelEvent("anonymous_upload_started", {
      fileName: selectedFile.name
    });

    try {
      const formData = new FormData();
      formData.set("document", selectedFile);

      const response = await fetch("/api/public/intake/upload", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        if (
          response.status === 429 &&
          payload.code === "ANONYMOUS_UPLOAD_LIMIT_REACHED"
        ) {
          const redirectTo =
            typeof payload.redirectTo === "string"
              ? payload.redirectTo
              : buildAuthHref("sign-up", "/app/intake/new");

          setUploadLimitGate({
            message:
              typeof payload.error === "string"
                ? payload.error
                : "You’ve used the free uploads for now.",
            signUpHref: redirectTo,
            signInHref: buildAuthHref("sign-in", "/app/intake/new")
          });
          setUploadState("idle");
          return;
        }

        throw new Error(payload.error ?? "Could not analyze that document.");
      }

      setAnalysisToken(payload.analysisToken as string);
      setBreakdown(payload.breakdown as AnonymousDealBreakdown);
      setUploadState("done");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not analyze that document."
      );
      setUploadState("idle");
    }
  }

  async function handleSaveDeal() {
    if (!analysisToken || isClaiming) {
      return;
    }

    setIsClaiming(true);
    trackPublicFunnelEvent("anonymous_save_cta_clicked", {
      hasAccount: false
    });
    window.sessionStorage.setItem(
      ANONYMOUS_ANALYSIS_TOKEN_STORAGE_KEY,
      analysisToken
    );
    window.location.href = buildAuthHref("sign-up", "/upload/claim");
  }

  if (breakdown) {
    return (
      <PublicContractBreakdown
        breakdown={breakdown}
        eyebrow="Document breakdown"
        title="Here’s what we found"
        description="You’ve already seen the value. Save this deal to track deliverables, revisit the document, and keep payment follow-up in one place."
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleSaveDeal()}
              disabled={isClaiming}
              className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/92 disabled:opacity-60"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving deal
                </>
              ) : (
                <>
                  Save My Deal
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setBreakdown(null);
                setAnalysisToken(null);
                setSelectedFile(null);
                setUploadState("idle");
                setIsClaiming(false);
                setErrorMessage(null);
                inputRef.current?.focus();
              }}
              className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-6 text-sm font-semibold text-foreground transition hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]"
            >
              Analyze another document
            </button>
          </>
        }
        stickyAction={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Want this saved in your workspace?
              </p>
              <p className="text-sm text-muted-foreground">
                Keep the breakdown, track deliverables, and come back anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveDeal()}
              disabled={isClaiming}
              className="inline-flex h-11 items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/92 disabled:opacity-60"
            >
              {isClaiming ? "Saving..." : "Save My Deal"}
            </button>
          </div>
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-foreground dark:bg-[#0f1115]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
            Back to home
          </Link>
          <Link href="/sample" className="text-sm font-medium text-primary transition hover:text-primary/80">
            Try sample contract
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
              Upload a document
            </p>
            <h1 className="mt-4 text-[2.4rem] font-bold leading-[0.96] tracking-[-0.05em] text-[#17202b] sm:text-[3.4rem] dark:text-white">
              Turn a deal document into a workspace in one step.
            </h1>
            <p className="mx-auto mt-5 max-w-[58ch] text-[1rem] leading-relaxed text-muted-foreground sm:text-[1.08rem]">
              Upload a contract, brief, or concept document. We’ll analyze it,
              explain what matters, and pull out the deliverables and payment context.
            </p>
          </div>

          {uploadLimitGate ? (
            <div className="mx-auto mt-10 w-full max-w-3xl border border-black/8 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center bg-primary/10 text-primary">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Your free uploads are used up.
                </h2>
                <p className="mx-auto mt-4 max-w-[50ch] text-sm leading-6 text-muted-foreground">
                  {uploadLimitGate.message}
                </p>
                <p className="mx-auto mt-3 max-w-[50ch] text-sm leading-6 text-muted-foreground">
                  Create an account to continue uploading documents inside HelloBrand and
                  keep them in your workspace.
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href={uploadLimitGate.signUpHref}
                    className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/92"
                  >
                    Create an account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={uploadLimitGate.signInHref}
                    className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-6 text-sm font-semibold text-foreground transition hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    Sign in
                  </Link>
                </div>

                <div className="mt-6 text-sm text-muted-foreground">
                  Want to explore first?{" "}
                  <Link href="/sample" className="font-medium text-primary transition hover:text-primary/80">
                    Try the sample contract
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit} className="mx-auto mt-10 w-full max-w-3xl">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="group flex w-full flex-col items-center justify-center border border-dashed border-black/15 bg-white px-8 py-16 text-center transition hover:border-primary/50 hover:bg-primary/[0.02] dark:border-white/12 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
              >
                <div className="flex h-14 w-14 items-center justify-center bg-primary/10 text-primary">
                  <FileUp className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-foreground">
                  {selectedFile ? selectedFile.name : "Drop your document here"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  PDF, DOCX, DOC, TXT up to 10 MB. Contracts, briefs, and concept documents.
                </p>
                <div className="mt-6 inline-flex h-11 items-center justify-center border border-black/8 bg-white px-5 text-sm font-semibold text-foreground transition group-hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]">
                  Choose file
                </div>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="inline-flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4" />
                  Private and secure
                </div>
                <div className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  No legal knowledge needed
                </div>
              </div>

              {errorMessage ? (
                <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  {errorMessage}
                </div>
              ) : null}

              {processingLabel ? (
                <div className="mt-6 border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing your document...
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    {processingLabel.map((label) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="h-2 w-2 animate-pulse bg-primary" />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/92 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadState === "uploading" ? "Analyzing..." : "Analyze document"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
