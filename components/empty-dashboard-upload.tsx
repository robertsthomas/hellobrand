"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";

import { InfoTooltip } from "@/components/app-tooltip";
import { ACCEPTED_DOCUMENT_TYPES } from "@/components/intake-file-field";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { captureAppEvent } from "@/lib/posthog/events";
import { deriveWorkspaceTitleFromFileNames } from "@/lib/workspace-labels";
import { WORKSPACE_GENERATION_NOTIFICATION_HINT_KEY } from "@/lib/workspace-generation-hint";
import {
  deleteLocalWorkspace,
  loadLocalWorkspace,
  readLocalWorkspaceManifest,
  saveLocalWorkspace,
  type LocalWorkspaceInputSource,
  type LocalWorkspaceManifestItem
} from "@/lib/browser/local-workspace-queue";
import type { IntakeDraftListItem } from "@/lib/types";
import { useIntakeUiStore, type SelectedFileMeta } from "@/lib/stores/intake-ui-store";
import { cn } from "@/lib/utils";

interface ServerQueuedWorkspaceItem {
  sessionId: string;
  dealId: string;
  brandName: string;
  campaignName: string;
  updatedAt: string;
  status: "queued";
  inputSource: "upload" | "paste" | "mixed" | null;
}

function buildWorkspaceLabel(input: {
  files: File[];
  pastedText: string;
  fallbackCampaignName?: string | null;
}) {
  if (input.fallbackCampaignName && input.fallbackCampaignName !== "Untitled deal") {
    return input.fallbackCampaignName;
  }

  const subjectLine = input.pastedText
    .match(/^subject:\s*(.+)$/im)?.[1]
    ?.replace(/^(re|fwd?):\s*/gi, "")
    ?.trim();

  if (subjectLine) {
    return subjectLine;
  }

  const fileBackedTitle = deriveWorkspaceTitleFromFileNames(
    input.files.map((file) => file.name)
  );
  if (fileBackedTitle) {
    return fileBackedTitle;
  }

  return "Pasted brand context";
}

function buildWorkspaceBrand(input: {
  pastedText: string;
  fallbackBrandName?: string | null;
}) {
  if (input.fallbackBrandName && input.fallbackBrandName !== "Untitled brand") {
    return input.fallbackBrandName;
  }

  const brandLine = input.pastedText.match(/^brand:\s*(.+)$/im)?.[1]?.trim();
  return brandLine || "Workspace";
}

function detectLocalInputSource(files: File[], pastedText: string): LocalWorkspaceInputSource {
  if (files.length > 0 && pastedText.trim()) {
    return "mixed";
  }

  if (pastedText.trim()) {
    return "paste";
  }

  return "upload";
}

function sourceSummary(inputSource: "upload" | "paste" | "mixed" | null) {
  if (inputSource === "mixed") {
    return "Files + pasted text";
  }

  if (inputSource === "paste") {
    return "Pasted text";
  }

  return "Uploaded documents";
}

const GENERATE_WORKSPACE_BUTTON_CLASS =
  "h-10 border border-black/10 bg-white px-4 text-sm font-semibold text-foreground transition hover:border-black/20 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]";

function pendingSourceSummary(files: SelectedFileMeta[], pastedText: string) {
  const hasText = pastedText.trim().length > 0;

  if (files.length > 0 && hasText) {
    return `${files.length} file${files.length === 1 ? "" : "s"} and text added`;
  }

  if (files.length > 0) {
    return `${files.length} file${files.length === 1 ? "" : "s"} added`;
  }

  if (hasText) {
    return "Text added";
  }

  return "No sources yet";
}

function toServerQueuedWorkspaceItem(item: IntakeDraftListItem): ServerQueuedWorkspaceItem {
  const labels = getDisplayDealLabels(item.deal);

  return {
    sessionId: item.session.id,
    dealId: item.deal.id,
    brandName: labels.brandName ?? item.deal.brandName,
    campaignName: labels.campaignName ?? item.deal.campaignName,
    updatedAt: item.session.updatedAt,
    status: "queued",
    inputSource: item.session.inputSource
  };
}

export function EmptyDashboardUpload({
  initialMode = "upload",
  initialQueuedWorkspaces = []
}: {
  initialMode?: "upload" | "paste";
  initialQueuedWorkspaces?: IntakeDraftListItem[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const posthog = usePostHog();
  const [localWorkspaces, setLocalWorkspaces] = useState<LocalWorkspaceManifestItem[]>([]);
  const [serverQueuedWorkspaces, setServerQueuedWorkspaces] = useState<ServerQueuedWorkspaceItem[]>(
    initialQueuedWorkspaces.map(toServerQueuedWorkspaceItem)
  );
  const [isComposerVisible, setIsComposerVisible] = useState(
    initialQueuedWorkspaces.length === 0
  );

  const mode = useIntakeUiStore((state) => state.mode);
  const pendingFiles = useIntakeUiStore((state) => state.pendingFiles);
  const pastedText = useIntakeUiStore((state) => state.pastedText);
  const selectedFiles = useIntakeUiStore((state) => state.selectedFiles);
  const isSubmitting = useIntakeUiStore((state) => state.isSubmitting);
  const errorMessage = useIntakeUiStore((state) => state.errorMessage);
  const setMode = useIntakeUiStore((state) => state.setMode);
  const setPastedText = useIntakeUiStore((state) => state.setPastedText);
  const setSelectedFilesFromList = useIntakeUiStore(
    (state) => state.setSelectedFilesFromList
  );
  const setIsSubmitting = useIntakeUiStore((state) => state.setIsSubmitting);
  const setErrorMessage = useIntakeUiStore((state) => state.setErrorMessage);
  const reset = useIntakeUiStore((state) => state.reset);

  useEffect(() => {
    reset(initialMode);
    const stored = readLocalWorkspaceManifest();
    setLocalWorkspaces(stored);
    setServerQueuedWorkspaces(initialQueuedWorkspaces.map(toServerQueuedWorkspaceItem));
    setIsComposerVisible(stored.length === 0 && initialQueuedWorkspaces.length === 0);
  }, [initialMode, initialQueuedWorkspaces, reset]);

  const hasDraftSource = pendingFiles.length > 0 || pastedText.trim().length > 0;
  const queuedCount = localWorkspaces.length + serverQueuedWorkspaces.length;
  const pendingSummary = useMemo(
    () => pendingSourceSummary(selectedFiles, pastedText),
    [pastedText, selectedFiles]
  );

  async function createDraftSessionId(input: {
    brandName: string;
    campaignName: string;
  }) {
    const response = await fetch("/api/intake/draft", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    const payload = await response.json();

    if (!response.ok || !payload.session?.id) {
      throw new Error(payload.error ?? "Could not create workspace.");
    }

    return payload.session.id as string;
  }

  async function persistWorkspaceLocally() {
    const item = await saveLocalWorkspace({
      files: pendingFiles,
      pastedText: pastedText.trim(),
      brandName: buildWorkspaceBrand({
        pastedText,
        fallbackBrandName: null
      }),
      campaignName: buildWorkspaceLabel({
        files: pendingFiles,
        pastedText,
        fallbackCampaignName: null
      }),
      inputSource: detectLocalInputSource(pendingFiles, pastedText)
    });

    setLocalWorkspaces((current) => [...current, item]);
    reset(initialMode);
    setIsComposerVisible(false);
  }

  async function finishWorkspace() {
    if (!hasDraftSource) {
      setErrorMessage("Add documents or pasted text before saving this workspace.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await persistWorkspaceLocally();
      captureAppEvent(posthog, "workspace_saved", {
        sourceMode: mode,
        fileCount: pendingFiles.length,
        hasPastedText: Boolean(pastedText.trim())
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save this workspace."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeLocalWorkspace(localId: string) {
    await deleteLocalWorkspace(localId);
    setLocalWorkspaces((current) => current.filter((workspace) => workspace.localId !== localId));
    if (localWorkspaces.length + serverQueuedWorkspaces.length === 1) {
      setIsComposerVisible(true);
    }
  }

  async function startAnalysisInBackground() {
    try {
      const createdSessionIds: string[] = [];

      for (const workspace of localWorkspaces) {
        const payload = await loadLocalWorkspace(workspace.localId);
        if (!payload) {
          throw new Error("A saved workspace is missing its local source data.");
        }

        const sessionId = await createDraftSessionId({
          brandName: workspace.brandName,
          campaignName: workspace.campaignName
        });

        const formData = new FormData();
        for (const file of payload.files) {
          formData.append("documents", file);
        }
        if (payload.pastedText.trim()) {
          formData.append("pastedText", payload.pastedText.trim());
        }
        formData.append("startProcessing", "0");

        const uploadResponse = await fetch(`/api/intake/${sessionId}/documents`, {
          method: "POST",
          body: formData
        });
        const uploadPayload = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadPayload.session?.id) {
          throw new Error(uploadPayload.error ?? "Could not queue workspace analysis.");
        }

        createdSessionIds.push(sessionId);
        await deleteLocalWorkspace(workspace.localId);
      }

      const response = await fetch("/api/intake/queue/start", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionIds: [
            ...serverQueuedWorkspaces.map((workspace) => workspace.sessionId),
            ...createdSessionIds
          ]
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.session?.id) {
        throw new Error(payload.error ?? "Could not start analysis.");
      }

      router.refresh();
    } catch (error) {
      console.error("[startAnalysisInBackground] Failed:", error);
      router.refresh();
    }
  }

  async function startAnalysis() {
    if (queuedCount === 0) {
      setErrorMessage("Save at least one workspace before starting analysis.");
      return;
    }

    setErrorMessage(null);
    reset(initialMode);
    window.sessionStorage.setItem(
      WORKSPACE_GENERATION_NOTIFICATION_HINT_KEY,
      "1"
    );
    captureAppEvent(posthog, "workspace_analysis_started", {
      queuedCount,
      localWorkspaceCount: localWorkspaces.length,
      serverQueuedCount: serverQueuedWorkspaces.length
    });
    router.push("/app");
    void startAnalysisInBackground();
  }

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-6">
      {isComposerVisible ? (
        <div className="space-y-3 border-t border-black/8 pt-4 dark:border-white/10 sm:space-y-5 sm:pt-5">
          <div className="flex items-center gap-2">
            <div className="inline-flex w-full max-w-[290px] border border-black/10 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:max-w-[320px]">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  captureAppEvent(posthog, "workspace_source_mode_selected", {
                    mode: "upload",
                    surface: "empty_dashboard_upload"
                  });
                  setMode("upload");
                  setErrorMessage(null);
                }}
                className={cn(
                  "flex-1 rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
                  mode === "upload"
                    ? "bg-ocean text-white shadow-sm"
                    : "text-black/60 hover:bg-black/[0.03] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white"
                )}
              >
                Upload files
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  captureAppEvent(posthog, "workspace_source_mode_selected", {
                    mode: "paste",
                    surface: "empty_dashboard_upload"
                  });
                  setMode("paste");
                  setErrorMessage(null);
                }}
                className={cn(
                  "flex-1 rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
                  mode === "paste"
                    ? "bg-ocean text-white shadow-sm"
                    : "text-black/60 hover:bg-black/[0.03] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white"
                )}
              >
                Paste text
              </button>
            </div>
            <InfoTooltip
              label="Workspace help"
              content={
                mode === "upload"
                  ? "Add one workspace, save it, then start analysis. Contracts, briefs, and email files all work."
                  : "Paste the contract, brief, or email text for one workspace, then save it and start analysis."
              }
              className="shrink-0 sm:hidden"
            />
          </div>

          <div className="grid gap-3 text-left sm:gap-4">
            <p className="hidden text-sm text-muted-foreground sm:block">
              Add one workspace, save it, then start analysis.
            </p>

            {mode === "upload" ? (
              <div className="grid gap-3 border border-dashed border-black/10 p-3 dark:border-white/10 sm:gap-4 sm:p-4">
                <input
                  ref={inputRef}
                  className="hidden"
                  type="file"
                  multiple
                  accept={ACCEPTED_DOCUMENT_TYPES}
                  onChange={(event) => {
                    setSelectedFilesFromList(event.currentTarget.files);
                    setErrorMessage(null);
                  }}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="hidden text-sm text-muted-foreground sm:block">
                    {selectedFiles.length > 0
                      ? pendingSummary
                      : "PDF, DOCX, PPTX, XLSX, TXT, and email files."}
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      captureAppEvent(posthog, "workspace_file_picker_clicked", {
                        surface: "empty_dashboard_upload",
                        mode
                      });
                      inputRef.current?.click();
                    }}
                    data-guide="add-documents"
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        className:
                          "w-auto self-start justify-center gap-2 px-4 sm:self-auto"
                      })
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    {selectedFiles.length > 0 ? "Add more" : "Add documents"}
                  </button>
                </div>
                {selectedFiles.length > 0 ? (
                  <div className="grid gap-2 border border-black/8 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    {selectedFiles.slice(0, 4).map((file) => (
                      <div
                        key={`${file.name}:${file.size}:${file.type}`}
                        className="flex min-w-0 items-center gap-2 text-sm text-[#667085] dark:text-[#a3acb9]"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      </div>
                    ))}
                    {selectedFiles.length > 4 ? (
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#98a2b3] dark:text-[#8f98a6]">
                        +{selectedFiles.length - 4} more
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="hidden text-xs text-black/45 dark:text-white/45 sm:block">
                    Add a contract, brief, or email file.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3 border border-dashed border-black/10 p-3 dark:border-white/10 sm:p-4">
                <p className="hidden text-sm text-muted-foreground sm:block">
                  Paste the brief, email, or contract text.
                </p>
                <Textarea
                  name="pastedText"
                  value={pastedText}
                  onChange={(event) => {
                    setPastedText(event.currentTarget.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Paste text"
                  className="min-h-28 border-black/10 bg-white px-4 py-3 text-sm shadow-none dark:border-white/12 dark:bg-white/[0.04] sm:min-h-44"
                />
                {pastedText.trim() ? (
                  <p className="hidden text-xs text-black/45 dark:text-white/45 sm:block">
                    {pendingSummary}
                  </p>
                ) : null}
              </div>
            )}

            {(selectedFiles.length > 0 || pastedText.trim()) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void finishWorkspace()}
                className={cn(
                  buttonVariants({
                    className:
                      "w-full justify-center gap-2"
                  })
                )}
              >
                {isSubmitting ? "Saving..." : "Save workspace"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {queuedCount > 0 ? (
        <div className="grid gap-5 border-t border-black/8 pt-5 text-left dark:border-white/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Ready to analyze</h3>
              <p className="text-sm text-muted-foreground sm:hidden">
                {queuedCount} workspace{queuedCount === 1 ? "" : "s"} generated.
              </p>
              <p className="hidden text-sm text-muted-foreground sm:block">
                {queuedCount} workspace{queuedCount === 1 ? "" : "s"} generated and ready to queue.
              </p>
            </div>
          </div>

          {localWorkspaces.length > 0 ? (
            <div className="grid gap-3">
              <div className="divide-y divide-black/8 border-y border-black/8 dark:divide-white/10 dark:border-white/10">
                {localWorkspaces.map((workspace) => {
                  const labels = getDisplayDealLabels(workspace);

                  return (
                    <div
                      key={workspace.localId}
                      className="grid gap-2 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <p className="truncate text-base font-semibold text-foreground">
                          {labels.campaignName ?? workspace.campaignName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {labels.brandName ?? workspace.brandName}
                        </p>
                        <p className="text-sm text-[#667085] dark:text-[#a3acb9]">
                          {sourceSummary(workspace.inputSource)}
                          {workspace.fileCount > 0
                            ? ` • ${workspace.fileCount} file${workspace.fileCount === 1 ? "" : "s"}`
                            : ""}
                          {workspace.hasPastedText ? " • text added" : ""}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                        <button
                          type="button"
                          onClick={() => void removeLocalWorkspace(workspace.localId)}
                          className="text-sm text-black/45 transition hover:text-clay dark:text-white/45 dark:hover:text-clay"
                          aria-label={`Remove ${labels.campaignName ?? workspace.campaignName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <span className="text-xs font-medium text-black/55 dark:text-white/55">
                          Ready to start
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void startAnalysis()}
                  className={cn(
                    buttonVariants({
                      variant: "outline",
                      className: GENERATE_WORKSPACE_BUTTON_CLASS
                    })
                  )}
                >
                  Generate workspace
                </button>
                {!isComposerVisible ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      captureAppEvent(posthog, "workspace_add_another_clicked", {
                        surface: "queued_workspaces"
                      });
                      reset(initialMode);
                      setErrorMessage(null);
                      setIsComposerVisible(true);
                    }}
                    className="text-sm font-medium text-black/60 underline underline-offset-4 transition hover:text-black disabled:opacity-50 dark:text-white/60 dark:hover:text-white"
                  >
                    Add another workspace
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {localWorkspaces.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void startAnalysis()}
                className={cn(
                  buttonVariants({
                    variant: "outline",
                    className: GENERATE_WORKSPACE_BUTTON_CLASS
                  })
                )}
              >
                Generate workspace
              </button>
              {!isComposerVisible ? (
                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      captureAppEvent(posthog, "workspace_add_another_clicked", {
                        surface: "server_queued_workspaces"
                      });
                      reset(initialMode);
                      setErrorMessage(null);
                      setIsComposerVisible(true);
                  }}
                  className="text-sm font-medium text-black/60 underline underline-offset-4 transition hover:text-black disabled:opacity-50 dark:text-white/60 dark:hover:text-white"
                >
                  Add another workspace
                </button>
              ) : null}
            </div>
          ) : null}

          {serverQueuedWorkspaces.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3] dark:text-[#8f98a6]">
                Already queued
              </p>
              <div className="divide-y divide-black/8 border-y border-black/8 dark:divide-white/10 dark:border-white/10">
                {serverQueuedWorkspaces.map((workspace) => {
                  const labels = getDisplayDealLabels(workspace);

                  return (
                    <div
                      key={workspace.sessionId}
                      className="grid gap-2 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">
                          {labels.campaignName ?? workspace.campaignName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {labels.brandName ?? workspace.brandName}
                        </p>
                        <p className="mt-2 text-sm text-[#667085] dark:text-[#a3acb9]">
                          {sourceSummary(workspace.inputSource)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                        <span className="text-xs font-medium text-[#98a2b3] dark:text-[#8f98a6]">
                          Queued on server
                        </span>
                        <Link
                          href={`/app/intake/${workspace.sessionId}`}
                          className="text-sm font-medium text-black/60 transition hover:text-black dark:text-white/60 dark:hover:text-white"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? <p className="text-sm text-clay">{errorMessage}</p> : null}
    </div>
  );
}
