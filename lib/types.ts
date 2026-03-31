export type DealStatus =
  | "contract_received"
  | "negotiating"
  | "signed"
  | "deliverables_pending"
  | "submitted"
  | "awaiting_payment"
  | "paid"
  | "completed"
  | "archived";

export type PaymentStatus =
  | "not_invoiced"
  | "invoiced"
  | "awaiting_payment"
  | "paid"
  | "late";

export type InvoiceStatus = "draft" | "finalized";
export type InvoiceReminderTouchpointStatus = "pending" | "sent" | "cancelled";

export type CountersignStatus = "unknown" | "pending" | "signed";
export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";

export type DocumentKind =
  | "contract"
  | "deliverables_brief"
  | "campaign_brief"
  | "pitch_deck"
  | "invoice"
  | "email_thread"
  | "unknown";

export type SummaryType = "legal" | "plain_language" | "short";
export type SummarySource = "analysis" | "simplification";

export type JobType =
  | "extract_text"
  | "classify_document"
  | "section_document"
  | "extract_fields"
  | "merge_results"
  | "analyze_risks"
  | "generate_summary";

export type IntakeProcessingStageId =
  | "extracting"
  | "structuring"
  | "risk_review"
  | "summary";

export type DraftIntent =
  | "clarify-clause"
  | "request-faster-payment"
  | "limit-usage-rights"
  | "clarify-deadline"
  | "payment-reminder"
  | "request-contract-revisions"
  | "confirm-deliverables"
  | "confirm-revised-brief";

export type EmailProvider = "gmail" | "outlook" | "yahoo";
export type EmailAccountStatus =
  | "connected"
  | "syncing"
  | "reconnect_required"
  | "error"
  | "disconnected";
export type EmailDirection = "inbound" | "outbound";
export type EmailLinkSource = "manual" | "ai_suggested" | "rule_based";
export type EmailCandidateStatus = "suggested" | "confirmed" | "rejected";
export type EmailDealEventCategory =
  | "payment"
  | "timeline"
  | "deliverable"
  | "approval"
  | "rights"
  | "attachment"
  | "ask";
export type EmailTermSuggestionStatus = "pending" | "applied" | "dismissed";
export type EmailActionItemStatus = "pending" | "completed" | "dismissed";
export type EmailActionItemUrgency = "low" | "medium" | "high";
export type NegotiationStance = "firm" | "collaborative" | "exploratory";
export type RiskFlagSourceType = "document" | "email";

export interface EmailParticipant {
  name: string | null;
  email: string;
}

export interface Viewer {
  id: string;
  email: string;
  displayName: string;
  mode: "demo" | "supabase" | "clerk";
}

export interface DealRecord {
  id: string;
  userId: string;
  brandName: string;
  campaignName: string;
  status: DealStatus;
  paymentStatus: PaymentStatus;
  countersignStatus: CountersignStatus;
  summary: string | null;
  legalDisclaimer: string;
  nextDeliverableDate: string | null;
  createdAt: string;
  updatedAt: string;
  analyzedAt: string | null;
  confirmedAt: string | null;
  statusBeforeArchive: string | null;
}

export interface DocumentRecord {
  id: string;
  dealId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  processingStatus: ProcessingStatus;
  rawText: string | null;
  normalizedText: string | null;
  documentKind: DocumentKind;
  classificationConfidence: number | null;
  sourceType: "file" | "pasted_text";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverableItem {
  id: string;
  title: string;
  dueDate: string | null;
  channel: string | null;
  quantity: number | null;
  status?: "pending" | "in_progress" | "completed" | "overdue";
  description?: string | null;
  source?: string | null;
}

export interface IntakePrimaryContact {
  organizationType: "brand" | "agency" | null;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface IntakeTimelineItem {
  id: string;
  label: string;
  date: string | null;
  source: string | null;
  status: "pending" | "scheduled" | "completed" | "unknown";
}

export interface IntakeAnalyticsRecord {
  highlights: string[];
}

export interface IntakeEvidenceGroup {
  id: string;
  title: string;
  snippets: string[];
}

export type DealCategory =
  | "beauty_personal_care"
  | "fashion_apparel"
  | "food_beverage"
  | "entertainment_media"
  | "fitness_wellness"
  | "parenting_family"
  | "tech_gaming"
  | "travel_hospitality"
  | "finance"
  | "home_lifestyle"
  | "retail_ecommerce"
  | "sports_outdoors"
  | "other";

export interface CampaignDateWindow {
  startDate: string | null;
  endDate: string | null;
  postingWindow: string | null;
}

export interface DisclosureObligation {
  id: string;
  title: string;
  detail: string;
  source: string | null;
}

export type ConflictType =
  | "category_conflict"
  | "competitor_restriction"
  | "exclusivity_overlap"
  | "schedule_collision";

export type ConflictLevel = "hard_conflict" | "warning" | "informational";

export interface ConflictResult {
  type: ConflictType;
  level: ConflictLevel;
  severity: "low" | "medium" | "high";
  confidence: number;
  title: string;
  detail: string;
  relatedDealIds: string[];
  evidenceRefs: string[];
  acknowledgedAt?: string | null;
  acknowledgedByUser?: string | null;
}

export interface NormalizedIntakeRecord {
  brandName: string | null;
  agencyName: string | null;
  primaryContact: IntakePrimaryContact;
  contractTitle: string | null;
  contractSummary: string | null;
  paymentAmount: number | null;
  currency: string | null;
  deliverableCount: number;
  deliverables: DeliverableItem[];
  timelineItems: IntakeTimelineItem[];
  brandCategory: DealCategory | null;
  competitorCategories: string[];
  restrictedCategories: string[];
  campaignDateWindow: CampaignDateWindow | null;
  disclosureObligations: DisclosureObligation[];
  analytics: IntakeAnalyticsRecord | null;
  notes: string | null;
  evidenceGroups: IntakeEvidenceGroup[];
}

export interface BriefData {
  campaignOverview: string | null;
  messagingPoints: string[];
  talkingPoints: string[];
  creativeConceptOverview: string | null;
  brandGuidelines: string | null;
  approvalRequirements: string | null;
  targetAudience: string | null;
  toneAndStyle: string | null;
  doNotMention: string[];
  sourceDocumentIds: string[];
}

export interface GeneratedBriefSection {
  id: string;
  title: string;
  content: string;
  items?: string[];
}

export interface GeneratedBrief {
  sections: GeneratedBriefSection[];
  generatedAt: string;
  modelVersion: string;
}

export interface DealTermsRecord {
  id: string;
  dealId: string;
  brandName: string | null;
  agencyName: string | null;
  creatorName: string | null;
  campaignName: string | null;
  paymentAmount: number | null;
  currency: string | null;
  paymentTerms: string | null;
  paymentStructure: string | null;
  netTermsDays: number | null;
  paymentTrigger: string | null;
  deliverables: DeliverableItem[];
  usageRights: string | null;
  usageRightsOrganicAllowed: boolean | null;
  usageRightsPaidAllowed: boolean | null;
  whitelistingAllowed: boolean | null;
  usageDuration: string | null;
  usageTerritory: string | null;
  usageChannels: string[];
  exclusivity: string | null;
  exclusivityApplies: boolean | null;
  exclusivityCategory: string | null;
  exclusivityDuration: string | null;
  exclusivityRestrictions: string | null;
  brandCategory: DealCategory | null;
  competitorCategories: string[];
  restrictedCategories: string[];
  campaignDateWindow: CampaignDateWindow | null;
  disclosureObligations: DisclosureObligation[];
  revisions: string | null;
  revisionRounds: number | null;
  termination: string | null;
  terminationAllowed: boolean | null;
  terminationNotice: string | null;
  terminationConditions: string | null;
  governingLaw: string | null;
  notes: string | null;
  manuallyEditedFields: string[];
  briefData: BriefData | null;
  pendingExtraction: PendingExtractionData | null;
  createdAt: string;
  updatedAt: string;
}

export type PendingExtractionData = Omit<
  DealTermsRecord,
  "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction"
>;

export interface TermsDiffEntry {
  field: string;
  label: string;
  currentValue: unknown;
  proposedValue: unknown;
  isManuallyEdited: boolean;
  fieldType: "scalar" | "json_array" | "boolean" | "number";
}

export interface PendingChangesSummary {
  hasPendingChanges: boolean;
  totalChangedFields: number;
  manuallyEditedConflicts: number;
  entries: TermsDiffEntry[];
}

export interface RiskFlagRecord {
  id: string;
  dealId: string;
  category:
    | "usage_rights"
    | "exclusivity"
    | "payment_terms"
    | "deliverables"
    | "termination"
    | "other";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  suggestedAction: string | null;
  evidence: string[];
  sourceDocumentId: string | null;
  sourceType?: RiskFlagSourceType | null;
  sourceMessageId?: string | null;
  createdAt: string;
}

export interface EmailDraftRecord {
  id: string;
  dealId: string;
  intent: DraftIntent;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
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
  confidence: number | null;
  createdAt: string;
}

export interface EmailThreadListItem {
  thread: EmailThreadRecord;
  account: ConnectedEmailAccountRecord;
  links: EmailThreadLinkView[];
  importantEventCount: number;
  latestImportantEventAt: string | null;
  pendingTermSuggestionCount: number;
  pendingActionItemCount: number;
  latestPendingActionItemAt: string | null;
}

export interface EmailThreadDetail {
  thread: EmailThreadRecord;
  account: ConnectedEmailAccountRecord;
  messages: EmailMessageRecord[];
  links: EmailThreadLinkView[];
  importantEvents: EmailDealEventRecord[];
  termSuggestions: EmailDealTermSuggestionRecord[];
  actionItems: EmailActionItemRecord[];
  promiseDiscrepancies: PromiseDiscrepancy[];
  crossDealConflicts: ConflictResult[];
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

export interface JobRecord {
  id: string;
  dealId: string;
  documentId: string;
  type: JobType;
  status: ProcessingStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  failureReason: string | null;
}

export interface DocumentSectionRecord {
  id: string;
  documentId: string;
  title: string;
  content: string;
  chunkIndex: number;
  pageRange: string | null;
  createdAt: string;
}

export interface ExtractionEvidenceRecord {
  id: string;
  documentId: string;
  fieldPath: string;
  snippet: string;
  sectionId: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface ExtractionResultRecord {
  id: string;
  documentId: string;
  schemaVersion: string;
  model: string;
  data: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction">;
  confidence: number | null;
  conflicts: string[];
  createdAt: string;
}

export interface SummaryRecord {
  id: string;
  dealId: string;
  documentId: string | null;
  body: string;
  version: string;
  summaryType: SummaryType | null;
  source: SummarySource | null;
  parentSummaryId: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface SummaryRecordInput {
  body: string;
  version: string;
  summaryType?: SummaryType | null;
  source?: SummarySource | null;
  parentSummaryId?: string | null;
  isCurrent?: boolean;
}

export type AssistantScope = "user" | "deal";

export type AssistantDealTab =
  | "overview"
  | "terms"
  | "risks"
  | "deliverables"
  | "brief"
  | "emails"
  | "documents"
  | "invoices"
  | "notes";

export type AssistantTriggerKind =
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

export interface AssistantClientContext {
  pathname: string;
  pageTitle: string;
  dealId: string | null;
  tab: AssistantDealTab | null;
  trigger: AssistantTrigger | null;
  tone: AssistantTone;
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

export interface AssistantNavigationAction {
  type: "navigation";
  label: string;
  href: string;
  description?: string | null;
}

export interface AssistantDraftArtifact {
  type: "draft";
  label: string;
  subject: string;
  body: string;
}

export interface AssistantCitation {
  label: string;
  detail: string;
}

export interface AssistantWorkspaceListItem {
  dealId: string;
  brandName: string;
  campaignName: string;
  status: DealStatus;
  paymentStatus: PaymentStatus;
  href: string;
  prompt: string | null;
}

export interface AssistantWorkspaceListBlock {
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

export type IntakeSessionStatus =
  | "draft"
  | "queued"
  | "uploading"
  | "processing"
  | "ready_for_confirmation"
  | "failed"
  | "completed"
  | "expired";

export interface IntakeSessionRecord {
  id: string;
  userId: string;
  dealId: string;
  status: IntakeSessionStatus;
  errorMessage: string | null;
  inputSource: "upload" | "paste" | "mixed" | null;
  draftBrandName: string | null;
  draftCampaignName: string | null;
  draftNotes: string | null;
  draftPastedText: string | null;
  draftPastedTextTitle: string | null;
  duplicateCheckStatus: "pending" | "checking" | "clean" | "duplicates_found" | null;
  duplicateMatchJson: unknown | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface IntakeProcessingSnapshot {
  currentStage: IntakeProcessingStageId | null;
  activeJobType: JobType | null;
  activeLabel: string;
  activeDescription: string;
  completedStages: IntakeProcessingStageId[];
}

export interface IntakeDraftListItem {
  session: IntakeSessionRecord;
  deal: Pick<DealRecord, "id" | "brandName" | "campaignName" | "updatedAt">;
}

export interface ProfileRecord {
  id: string;
  userId: string;
  displayName: string | null;
  creatorLegalName: string | null;
  businessName: string | null;
  contactEmail: string | null;
  preferredSignature: string | null;
  payoutDetails: string | null;
  defaultCurrency: string | null;
  reminderLeadDays: number | null;
  conflictAlertsEnabled: boolean;
  paymentRemindersEnabled: boolean;
  emailNotificationsEnabled: boolean;
  accentColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEmailDeliveryRecord {
  id: string;
  appNotificationId: string;
  userId: string;
  recipientEmail: string;
  provider: string;
  providerMessageId: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductGuideState {
  dismissedStepIds: string[];
  completedStepIds: string[];
}

export interface OnboardingStateRecord {
  id: string;
  userId: string;
  profileOnboardingCompletedAt: string | null;
  profileOnboardingVersion: number;
  profileOnboardingStateJson: unknown;
  productGuideVersion: number;
  productGuideStateJson: ProductGuideState;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileAuditRecord {
  id: string;
  profileId: string;
  actorUserId: string;
  changedFields: string[];
  snapshot: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  dealId: string;
  amount: number | null;
  currency: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  status: PaymentStatus;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceParty {
  name: string;
  email: string | null;
  companyName: string | null;
  address: string | null;
  taxId: string | null;
  payoutDetails: string | null;
}

export interface InvoiceLineItem {
  id: string;
  deliverableId: string | null;
  title: string;
  description: string | null;
  channel: string | null;
  quantity: number;
  unitRate: number;
  amount: number;
}

export interface InvoiceRecord {
  id: string;
  dealId: string;
  userId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  draftSavedAt: string | null;
  finalizedAt: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subtotal: number | null;
  notes: string | null;
  billTo: InvoiceParty;
  issuer: InvoiceParty;
  lineItems: InvoiceLineItem[];
  pdfDocumentId: string | null;
  manualNumberOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceReminderTouchpointRecord {
  id: string;
  dealId: string;
  userId: string;
  anchorDate: string;
  offsetDays: 0 | 1 | 3;
  sendOn: string;
  status: InvoiceReminderTouchpointStatus;
  notificationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IntakeBatchStatus = "clustering" | "review" | "confirmed" | "failed";
export type IntakeBatchGroupStatus = "pending" | "confirmed" | "rejected";

export interface IntakeBatchRecord {
  id: string;
  userId: string;
  status: IntakeBatchStatus;
  createdAt: string;
  updatedAt: string;
  groups: IntakeBatchGroupRecord[];
}

export interface IntakeBatchGroupRecord {
  id: string;
  batchId: string;
  intakeSessionId: string | null;
  label: string;
  confidence: number | null;
  documentIds: string[];
  status: IntakeBatchGroupStatus;
  createdAt: string;
}

export interface DealAggregate {
  deal: DealRecord;
  latestDocument: DocumentRecord | null;
  documents: DocumentRecord[];
  terms: DealTermsRecord | null;
  conflictResults: ConflictResult[];
  paymentRecord: PaymentRecord | null;
  invoiceRecord?: InvoiceRecord | null;
  riskFlags: RiskFlagRecord[];
  emailDrafts: EmailDraftRecord[];
  jobs: JobRecord[];
  documentSections: DocumentSectionRecord[];
  extractionResults: ExtractionResultRecord[];
  extractionEvidence: ExtractionEvidenceRecord[];
  summaries: SummaryRecord[];
  currentSummary: SummaryRecord | null;
  intakeSession: IntakeSessionRecord | null;
}

export interface AppStore {
  users: Viewer[];
  deals: DealRecord[];
  documents: DocumentRecord[];
  dealTerms: DealTermsRecord[];
  riskFlags: RiskFlagRecord[];
  emailDrafts: EmailDraftRecord[];
  emailAccounts: ConnectedEmailAccountRecord[];
  emailThreads: EmailThreadRecord[];
  emailMessages: EmailMessageRecord[];
  emailSyncStates: EmailSyncStateRecord[];
  dealEmailLinks: DealEmailLinkRecord[];
  emailCandidateMatches: EmailDealCandidateMatchRecord[];
  emailDealEvents: EmailDealEventRecord[];
  emailDealTermSuggestions: EmailDealTermSuggestionRecord[];
  emailActionItems: EmailActionItemRecord[];
  brandContacts: BrandContactRecord[];
  assistantThreads: AssistantThreadRecord[];
  assistantMessages: AssistantMessageRecord[];
  assistantContextSnapshots: AssistantContextSnapshotRecord[];
  invoiceRecords: InvoiceRecord[];
  invoiceReminderTouchpoints: InvoiceReminderTouchpointRecord[];
  jobs: JobRecord[];
  documentSections: DocumentSectionRecord[];
  extractionResults: ExtractionResultRecord[];
  extractionEvidence: ExtractionEvidenceRecord[];
  summaries: SummaryRecord[];
}

export interface FieldEvidence {
  fieldPath: string;
  snippet: string;
  sectionKey: string | null;
  confidence: number | null;
}

export interface DocumentSectionInput {
  title: string;
  content: string;
  chunkIndex: number;
  pageRange: string | null;
}

export interface DocumentClassificationResult {
  documentKind: DocumentKind;
  confidence: number | null;
}

export interface ExtractionPipelineResult {
  schemaVersion: string;
  model: string;
  confidence: number | null;
  data: Omit<DealTermsRecord, "id" | "dealId" | "createdAt" | "updatedAt" | "pendingExtraction">;
  evidence: FieldEvidence[];
  conflicts: string[];
}

export interface DocumentSummaryResult {
  body: string;
  version: string;
  summaryType?: SummaryType | null;
  source?: SummarySource | null;
  parentSummaryId?: string | null;
  isCurrent?: boolean;
}

export interface DocumentAnalysisResult {
  classification: DocumentClassificationResult;
  sections: DocumentSectionInput[];
  extraction: ExtractionPipelineResult;
  riskFlags: Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">[];
  summary: DocumentSummaryResult;
}

export interface AnonymousDealBreakdown {
  brandName: string | null;
  contractTitle: string | null;
  contractSummary: string | null;
  paymentAmount: number | null;
  currency: string | null;
  paymentSummary: string | null;
  deliverables: DeliverableItem[];
  riskFlags: Array<{
    id: string;
    title: string;
    detail: string;
    severity: "low" | "medium" | "high";
    suggestedAction: string | null;
  }>;
  documentKind: DocumentKind;
  sourceFileName: string;
}

export interface AnonymousAnalysisSessionRecord {
  id: string;
  token: string;
  fileName: string;
  mimeType: string;
  sourceType: "file" | "pasted_text";
  visitorId: string | null;
  ipHash: string | null;
  fileHash: string | null;
  storagePath: string | null;
  rawText: string | null;
  normalizedText: string;
  analysis: DocumentAnalysisResult;
  breakdown: AnonymousDealBreakdown;
  claimedByUserId: string | null;
  claimedDealId: string | null;
  claimedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnonymousUploadLedgerRecord {
  id: string;
  visitorId: string;
  ipHash: string;
  fileHash: string;
  createdAt: string;
}
