/**
 * Inbox, provider sync, and email collaboration record types.
 * Keep route handlers, provider client code, and workspace rendering logic out of this module.
 */

import type { EmailProvider } from "./common";
import type { ConflictResult, DealRecord } from "./deals";

type EmailAccountStatus =
  | "connected"
  | "syncing"
  | "reconnect_required"
  | "error"
  | "disconnected";
export type EmailDirection = "inbound" | "outbound";
type EmailLinkSource = "manual" | "ai_suggested" | "rule_based";
export type EmailLinkRole = "primary" | "reference";
type EmailCandidateStatus = "suggested" | "confirmed" | "rejected";
export type EmailDealEventCategory =
  | "payment"
  | "timeline"
  | "deliverable"
  | "approval"
  | "rights"
  | "attachment"
  | "ask";
type EmailTermSuggestionStatus = "pending" | "applied" | "dismissed";
type EmailActionItemStatus = "pending" | "completed" | "dismissed";
type EmailActionItemUrgency = "low" | "medium" | "high";
export type NegotiationStance = "firm" | "collaborative" | "exploratory";
export type EmailThreadWorkflowState =
  | "unlinked"
  | "needs_review"
  | "needs_reply"
  | "draft_ready"
  | "waiting_on_them"
  | "closed";
type EmailThreadDraftStatus = "in_progress" | "ready";
type EmailThreadDraftSource = "manual" | "ai";

export interface EmailParticipant {
  name: string | null;
  email: string;
}

export interface ConnectedEmailAccountRecord {
  id: string;
  userId: string;
  provider: EmailProvider;
  providerAccountId: string;
  emailAddress: string;
  displayName: string | null;
  status: EmailAccountStatus;
  scopes: string[];
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  mailAuthConfigured: boolean;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailThreadRecord {
  id: string;
  accountId: string;
  provider: EmailProvider;
  providerThreadId: string;
  subject: string;
  snippet: string | null;
  participants: EmailParticipant[];
  lastMessageAt: string;
  messageCount: number;
  isContractRelated: boolean;
  aiSummary: string | null;
  aiSummaryUpdatedAt: string | null;
  workflowState: EmailThreadWorkflowState;
  draftUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailAttachmentRecord {
  id: string;
  messageId: string;
  providerAttachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string | null;
  extractedText: string | null;
  createdAt: string;
}

export interface EmailMessageRecord {
  id: string;
  threadId: string;
  providerMessageId: string;
  internetMessageId: string | null;
  from: EmailParticipant | null;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  direction: EmailDirection;
  hasAttachments: boolean;
  rawStorageKey: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: EmailAttachmentRecord[];
}

export interface EmailSyncStateRecord {
  id: string;
  accountId: string;
  providerCursor: string | null;
  providerSubscriptionId: string | null;
  subscriptionExpiresAt: string | null;
  lastHistoryId: string | null;
  lastSuccessfulSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealEmailLinkRecord {
  id: string;
  dealId: string;
  threadId: string;
  linkSource: EmailLinkSource;
  role: EmailLinkRole;
  confidence: number | null;
  createdAt: string;
}

export interface EmailDealCandidateMatchRecord {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  status: EmailCandidateStatus;
  confidence: number;
  reasons: string[];
  evidence: Record<string, unknown>;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDealEventRecord {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  category: EmailDealEventCategory;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDealTermSuggestionRecord {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  status: EmailTermSuggestionStatus;
  title: string;
  summary: string;
  patch: Record<string, unknown>;
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailActionItemRecord {
  id: string;
  userId: string;
  dealId: string;
  threadId: string;
  messageId: string;
  action: string;
  dueDate: string | null;
  urgency: EmailActionItemUrgency;
  status: EmailActionItemStatus;
  sourceText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandContactRecord {
  id: string;
  userId: string;
  dealId: string;
  name: string;
  email: string;
  organization: string | null;
  inferredRole: string | null;
  lastSeenAt: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromiseDiscrepancy {
  field: string;
  emailClaim: string;
  contractValue: string;
  severity: "low" | "medium" | "high";
  sourceText: string;
  messageId: string;
}

export interface EmailThreadLinkView {
  id: string;
  dealId: string;
  threadId: string;
  dealName: string;
  brandName: string;
  campaignName: string;
  linkSource: EmailLinkSource;
  role: EmailLinkRole;
  confidence: number | null;
  createdAt: string;
}

export interface EmailThreadDraftRecord {
  id: string;
  userId: string;
  threadId: string;
  subject: string;
  body: string;
  status: EmailThreadDraftStatus;
  source: EmailThreadDraftSource;
  createdAt: string;
  updatedAt: string;
}

export interface EmailThreadNoteRecord {
  id: string;
  userId: string;
  threadId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailThreadListItem {
  thread: EmailThreadRecord;
  account: ConnectedEmailAccountRecord;
  links: EmailThreadLinkView[];
  primaryLink: EmailThreadLinkView | null;
  referenceLinks: EmailThreadLinkView[];
  importantEventCount: number;
  latestImportantEventAt: string | null;
  pendingTermSuggestionCount: number;
  pendingActionItemCount: number;
  latestPendingActionItemAt: string | null;
  savedDraft: EmailThreadDraftRecord | null;
  noteCount: number;
}

export interface EmailThreadDetail {
  thread: EmailThreadRecord;
  account: ConnectedEmailAccountRecord;
  messages: EmailMessageRecord[];
  links: EmailThreadLinkView[];
  primaryLink: EmailThreadLinkView | null;
  referenceLinks: EmailThreadLinkView[];
  importantEvents: EmailDealEventRecord[];
  termSuggestions: EmailDealTermSuggestionRecord[];
  actionItems: EmailActionItemRecord[];
  promiseDiscrepancies: PromiseDiscrepancy[];
  crossDealConflicts: ConflictResult[];
  savedDraft: EmailThreadDraftRecord | null;
  notes: EmailThreadNoteRecord[];
  noteCount: number;
}

export interface EmailThreadPreviewStateRecord {
  threadId: string;
  previewUpdatesSeenAt: string | null;
  previewUpdatesClearedAt: string | null;
  actionItemsSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDealCandidateMatchView {
  candidate: EmailDealCandidateMatchRecord;
  deal: DealRecord;
  thread: EmailThreadRecord;
  account: ConnectedEmailAccountRecord;
  links: EmailThreadLinkView[];
}

export interface EmailDealCandidateMatchGroup {
  deal: DealRecord;
  matches: EmailDealCandidateMatchView[];
}
