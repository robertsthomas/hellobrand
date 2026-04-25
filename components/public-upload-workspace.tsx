"use client";

import { ArrowRight, FileUp, Loader2, LockKeyhole, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { PostHogActionLink } from "@/components/posthog-action-link";
import { PublicContractBreakdown } from "@/components/public-contract-breakdown";
import { trackPublicFunnelEvent } from "@/lib/public-funnel-events";
import { ANONYMOUS_UPLOAD_MAX_FILE_SIZE_BYTES } from "@/lib/public-upload-config";
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
  "Flagging watchouts",
] as const;

function buildAuthHref(mode: "sign-in" | "sign-up", redirectTo: string) {
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("redirect", redirectTo);
  return `/login?${params.toString()}`;
}

// fallow-ignore-next-line complexity
export function PublicUploadWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<AnonymousDealBreakdown | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [uploadLimitGate, setUploadLimitGate] = useState<UploadLimitGate | null>(null);

  const canSubmit = Boolean(selectedFile) && uploadState !== "uploading";
  const processingLabel = uploadState === "uploading" ? PROCESSING_STEPS : null;

  function clearSelectedFile() {
    setSelectedFile(null);
    setErrorMessage(null);
    inputRef.current?.focus();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  // fallow-ignore-next-line complexity
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
      fileName: selectedFile.name,
    });

    try {
      const formData = new FormData();
      formData.set("document", selectedFile);

      const response = await fetch("/api/public/intake/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 429 && payload.code === "ANONYMOUS_UPLOAD_LIMIT_REACHED") {
          setUploadLimitGate({
            message:
              typeof payload.error === "string"
                ? payload.error
                : "You’ve already used your free preview.",
            signUpHref:
              typeof payload.signUpHref === "string"
                ? payload.signUpHref
                : buildAuthHref("sign-up", "/upload/claim"),
            signInHref:
              typeof payload.signInHref === "string"
                ? payload.signInHref
                : buildAuthHref("sign-in", "/upload/claim"),
          });
          setUploadState("idle");
          return;
        }

        throw new Error(payload.error ?? "Could not analyze that document.");
      }

      setBreakdown(payload.breakdown as AnonymousDealBreakdown);
      setUploadState("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not analyze that document.");
      setUploadState("idle");
    }
  }

  async function handleSaveDeal() {
    if (!breakdown || isClaiming) {
      return;
    }

    setIsClaiming(true);
    trackPublicFunnelEvent("anonymous_create_free_workspace_clicked", {
      hasAccount: false,
    });
    window.location.href = buildAuthHref("sign-up", "/upload/claim");
  }

  if (breakdown) {
    return (
      <PublicContractBreakdown
        breakdown={breakdown}
        eyebrow="Document breakdown"
        title="Here’s what we found"
        description="You’ve already seen the value. Create a free workspace to save this deal, track deliverables, and keep payment follow-up in one place."
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
                  Creating free workspace
                </>
              ) : (
                <>
                  Create Free Workspace
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setBreakdown(null);
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
                Want this saved in your free workspace?
              </p>
              <p className="text-sm text-muted-foreground">
                No card required. Save the breakdown, track deliverables, and come back anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveDeal()}
              disabled={isClaiming}
              className="inline-flex h-11 items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/92 disabled:opacity-60"
            >
              {isClaiming ? "Creating..." : "Create Free Workspace"}
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
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Back to home
          </Link>
          <Link
            href="/sample"
            className="text-sm font-medium text-primary transition hover:text-primary/80"
          >
            Try sample contract
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
              Upload a document
            </p>
            <h1 className="mt-4 text-[2.4rem] font-bold leading-[0.96] tracking-[-0.05em] text-[#17202b] sm:text-[3.4rem] dark:text-white">
              Upload free, then save your first workspace free.
            </h1>
            <p className="mx-auto mt-5 max-w-[58ch] text-[1rem] leading-relaxed text-muted-foreground sm:text-[1.08rem]">
              Upload a contract, brief, or concept document. We’ll analyze it, explain what matters,
              and pull out the deliverables and payment context. No card required to save your first
              workspace.
            </p>
          </div>

          {uploadLimitGate ? (
            <div className="mx-auto mt-10 w-full max-w-3xl border border-black/8 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center bg-primary/10 text-primary">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Your free preview is already used.
                </h2>
                <p className="mx-auto mt-4 max-w-[50ch] text-sm leading-6 text-muted-foreground">
                  {uploadLimitGate.message}
                </p>
                <p className="mx-auto mt-3 max-w-[50ch] text-sm leading-6 text-muted-foreground">
                  Create a free workspace to keep going inside HelloBrand and save a real deal.
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <PostHogActionLink
                    href={uploadLimitGate.signUpHref}
                    eventName="public_upload_gate_signup_clicked"
                    payload={{ location: "upload_limit_gate" }}
                    className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/92"
                  >
                    Create free workspace
                    <ArrowRight className="h-4 w-4" />
                  </PostHogActionLink>
                  <PostHogActionLink
                    href={uploadLimitGate.signInHref}
                    eventName="public_upload_gate_signin_clicked"
                    payload={{ location: "upload_limit_gate" }}
                    className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-6 text-sm font-semibold text-foreground transition hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    Sign in
                  </PostHogActionLink>
                </div>

                <div className="mt-6 text-sm text-muted-foreground">
                  Want to explore first?{" "}
                  <Link
                    href="/sample"
                    className="font-medium text-primary transition hover:text-primary/80"
                  >
                    Try the sample contract
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit} className="mx-auto mt-10 w-full max-w-3xl">
              <button
                type={selectedFile ? "submit" : "button"}
                onClick={() => {
                  if (!selectedFile) {
                    inputRef.current?.click();
                  }
                }}
                disabled={!canSubmit && Boolean(selectedFile)}
                className="group flex w-full flex-col items-center justify-center border border-dashed border-black/15 bg-white px-8 py-16 text-center transition hover:border-primary/50 hover:bg-primary/[0.02] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/12 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
              >
                <div className="flex h-14 w-14 items-center justify-center bg-primary/10 text-primary">
                  {uploadState === "uploading" ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <FileUp className="h-6 w-6" />
                  )}
                </div>
                <h2 className="mt-5 text-xl font-semibold text-foreground">
                  {selectedFile ? selectedFile.name : "Drop your document here"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  PDF, DOCX, DOC, PPTX, TXT up to 10 MB. Contracts, briefs, and concept documents.
                </p>
                <div className="mt-6 inline-flex h-11 items-center justify-center border border-black/8 bg-white px-5 text-sm font-semibold text-foreground transition group-hover:bg-secondary dark:border-white/10 dark:bg-white/[0.03]">
                  {uploadState === "uploading"
                    ? "Analyzing..."
                    : selectedFile
                      ? "Analyze document"
                      : "Choose file"}
                </div>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.pptx,.txt"
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

              {selectedFile ? (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    disabled={uploadState === "uploading"}
                    className="inline-flex h-11 items-center justify-center border border-black/8 bg-white px-5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    Clear document
                  </button>
                </div>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
