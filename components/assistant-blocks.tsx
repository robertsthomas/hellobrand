"use client";

import { Bot, Sparkles } from "lucide-react";

import { getDisplayDealLabels } from "@/lib/deal-labels";
import type { AssistantUiBlock } from "@/lib/types";

type AssistantBlockProps = {
  block: AssistantUiBlock;
  onNavigate: (href: string, options?: { prompt?: string | null; close?: boolean }) => void;
};

function AssistantNavigationBlock({
  label,
  description,
  href,
  onNavigate
}: {
  label: string;
  description?: string | null;
  href: string;
  onNavigate: AssistantBlockProps["onNavigate"];
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href, { close: true })}
      className="mb-3 mr-2 inline-flex items-center gap-2 border border-black/10 bg-black/3 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>{label}</span>
      {description ? <span className="text-black/45 dark:text-white/45">{description}</span> : null}
    </button>
  );
}

function AssistantDraftBlock({
  subject,
  body
}: {
  subject: string;
  body: string;
}) {
  return (
    <div className="space-y-3 border border-black/10 bg-black/3 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#98a2b3]">Draft Reply</p>
        <p className="mt-2 text-sm font-semibold text-foreground">{subject}</p>
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-black/75 dark:text-white/78">
        {body}
      </pre>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(`${subject}\n\n${body}`)}
        className="border border-black/10 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
      >
        Copy Draft
      </button>
    </div>
  );
}

function AssistantWorkspaceList({
  title,
  description,
  prompt,
  workspaces,
  onNavigate
}: {
  title: string;
  description: string;
  prompt: string | null;
  workspaces: Extract<AssistantUiBlock, { type: "workspace-list" }>["workspaces"];
  onNavigate: AssistantBlockProps["onNavigate"];
}) {
  return (
    <div className="space-y-3 border border-black/10 bg-black/3 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#98a2b3]">Choose Workspace</p>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-5 text-black/60 dark:text-white/65">{description}</p>
      </div>

      <div className="space-y-2">
        {workspaces.length > 0 ? (
          workspaces.map((workspace) => {
            const labels = getDisplayDealLabels(workspace);

            return (
              <button
                key={workspace.dealId}
                type="button"
                onClick={() =>
                  onNavigate(workspace.href, {
                    prompt: workspace.prompt ?? prompt,
                    close: false
                  })
                }
                className="flex w-full items-start justify-between gap-3 border border-black/10 bg-white px-3 py-3 text-left transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {labels.brandName ?? workspace.brandName}
                  </p>
                  <p className="truncate text-xs text-black/60 dark:text-white/65">
                    {labels.campaignName ?? workspace.campaignName}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[11px] uppercase tracking-[0.12em] text-[#98a2b3]">
                  <p>{workspace.status.replaceAll("_", " ")}</p>
                  <p className="mt-1">{workspace.paymentStatus.replaceAll("_", " ")}</p>
                </div>
              </button>
            );
          })
        ) : (
          <div className="border border-dashed border-black/10 px-3 py-3 text-xs text-black/60 dark:border-white/10 dark:text-white/65">
            No matching workspaces yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function AssistantBlock({ block, onNavigate }: AssistantBlockProps) {
  switch (block.type) {
    case "navigation":
      return (
        <AssistantNavigationBlock
          label={block.label}
          description={block.description}
          href={block.href}
          onNavigate={onNavigate}
        />
      );
    case "draft":
      return <AssistantDraftBlock subject={block.subject} body={block.body} />;
    case "workspace-list":
      return (
        <AssistantWorkspaceList
          title={block.title}
          description={block.description}
          prompt={block.prompt}
          workspaces={block.workspaces}
          onNavigate={onNavigate}
        />
      );
    default:
      return (
        <div className="border border-black/10 bg-black/3 px-3 py-3 text-xs text-black/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5" />
            Unsupported assistant block
          </div>
        </div>
      );
  }
}
