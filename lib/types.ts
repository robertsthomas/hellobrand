export type DealStatus =
  | "contract_received"
  | "negotiating"
  | "signed"
  | "deliverables_pending"
  | "submitted"
  | "awaiting_payment"
  | "paid"
  | "completed";

export type PaymentStatus =
  | "not_invoiced"
  | "invoiced"
  | "awaiting_payment"
  | "paid"
  | "late";

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
  createdAt: string;
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
  | "notes";

export type AssistantTriggerKind =
  | "risk_flag"
  | "payment"
  | "deliverable"
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
  riskFlags: RiskFlagRecord[];
  emailDrafts: EmailDraftRecord[];
  jobs: JobRecord[];
  documentSections: DocumentSectionRecord[];
  extractionResults: ExtractionResultRecord[];
  extractionEvidence: ExtractionEvidenceRecord[];
  summaries: SummaryRecord[];
  currentSummary: SummaryRecord | null;
}

export interface AppStore {
  users: Viewer[];
  deals: DealRecord[];
  documents: DocumentRecord[];
  dealTerms: DealTermsRecord[];
  riskFlags: RiskFlagRecord[];
  emailDrafts: EmailDraftRecord[];
  assistantThreads: AssistantThreadRecord[];
  assistantMessages: AssistantMessageRecord[];
  assistantContextSnapshots: AssistantContextSnapshotRecord[];
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
}

export interface DocumentAnalysisResult {
  classification: DocumentClassificationResult;
  sections: DocumentSectionInput[];
  extraction: ExtractionPipelineResult;
  riskFlags: Omit<RiskFlagRecord, "id" | "dealId" | "createdAt">[];
  summary: DocumentSummaryResult;
}
