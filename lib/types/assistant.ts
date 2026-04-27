/**
 * Assistant context, thread, and UI block record types.
 * Keep prompt construction, tool wiring, and persistence logic out of this module.
 */

import type { PaymentStatus } from "./billing";
import type { DealStatus } from "./deals";

export type AssistantScope = "user" | "deal";

export type AssistantDealTab =
  | "overview"
  | "terms"
  | "risks"
  | "deliverables"
  | "brief"
  | "emails"
  | "concepts"
  | "documents"
  | "invoices"
  | "notes";

type AssistantTriggerKind =
  | "risk_flag"
  | "payment"
  | "deliverable"
  | "approval"
  | "deal_context"
  | "email"
  | "general";

export interface AssistantTrigger {
  kind: AssistantTriggerKind;
  sourceId: string | null;
  prompt: string | null;
  label: string | null;
}

export type AssistantTone = "professional" | "friendly" | "direct" | "warm";

export interface AssistantPageContext {
  purpose: string;
  availableActions: string[];
  dataHints: string[];
}

export interface AssistantClientContext {
  pathname: string;
  pageTitle: string;
  dealId: string | null;
  tab: AssistantDealTab | null;
  profileLocation: string | null;
  trigger: AssistantTrigger | null;
  tone: AssistantTone;
  pageContext: AssistantPageContext | null;
}

export interface AssistantThreadRecord {
  id: string;
  userId: string;
  dealId: string | null;
  scope: AssistantScope;
  title: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessageRecord {
  id: string;
  threadId: string;
  role: "system" | "user" | "assistant";
  content: string;
  parts: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface AssistantContextSnapshotRecord {
  id: string;
  userId: string;
  dealId: string | null;
  scope: AssistantScope;
  key: string;
  version: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface AssistantNavigationAction {
  type: "navigation";
  label: string;
  href: string;
  description?: string | null;
}

interface AssistantDraftArtifact {
  type: "draft";
  label: string;
  subject: string;
  body: string;
}

interface AssistantCitation {
  label: string;
  detail: string;
}

interface AssistantWorkspaceListItem {
  dealId: string;
  brandName: string;
  campaignName: string;
  status: DealStatus;
  paymentStatus: PaymentStatus;
  href: string;
  prompt: string | null;
}

interface AssistantWorkspaceListBlock {
  type: "workspace-list";
  title: string;
  description: string;
  prompt: string | null;
  workspaces: AssistantWorkspaceListItem[];
}

export type AssistantUiBlock =
  | AssistantNavigationAction
  | AssistantDraftArtifact
  | AssistantWorkspaceListBlock;
