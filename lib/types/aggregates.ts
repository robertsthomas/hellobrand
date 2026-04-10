/**
 * Cross-domain aggregate and file-backed store record types.
 * Keep single-domain records in their own modules and compose them here.
 */

import type { AssistantContextSnapshotRecord, AssistantMessageRecord, AssistantThreadRecord } from "./assistant";
import type {
  InvoiceDeliveryRecord,
  InvoiceRecord,
  InvoiceReminderTouchpointRecord,
  PaymentRecord
} from "./billing";
import type { Viewer } from "./common";
import type {
  DealRecord,
  DealTermsRecord,
  EmailDraftRecord,
  RiskFlagRecord
} from "./deals";
import type {
  BrandContactRecord,
  ConnectedEmailAccountRecord,
  DealEmailLinkRecord,
  EmailActionItemRecord,
  EmailDealCandidateMatchRecord,
  EmailDealEventRecord,
  EmailDealTermSuggestionRecord,
  EmailMessageRecord,
  EmailSyncStateRecord,
  EmailThreadRecord
} from "./email";
import type { IntakeSessionRecord } from "./intake";
import type {
  DocumentArtifactRecord,
  DocumentFieldEvidenceRecord,
  DocumentRecord,
  DocumentReviewItemRecord,
  DocumentRunRecord,
  DocumentSectionRecord,
  ExtractionEvidenceRecord,
  ExtractionResultRecord,
  JobRecord,
  SummaryRecord
} from "./documents";

export interface DealAggregate {
  deal: DealRecord;
  latestDocument: DocumentRecord | null;
  documents: DocumentRecord[];
  terms: DealTermsRecord | null;
  conflictResults: import("./deals").ConflictResult[];
  paymentRecord: PaymentRecord | null;
  invoiceRecord?: InvoiceRecord | null;
  riskFlags: RiskFlagRecord[];
  emailDrafts: EmailDraftRecord[];
  jobs: JobRecord[];
  documentSections: DocumentSectionRecord[];
  documentRuns: DocumentRunRecord[];
  documentArtifacts: DocumentArtifactRecord[];
  documentFieldEvidence: DocumentFieldEvidenceRecord[];
  documentReviewItems: DocumentReviewItemRecord[];
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
  invoiceDeliveryRecords: InvoiceDeliveryRecord[];
  invoiceReminderTouchpoints: InvoiceReminderTouchpointRecord[];
  jobs: JobRecord[];
  documentSections: DocumentSectionRecord[];
  documentRuns: DocumentRunRecord[];
  documentArtifacts: DocumentArtifactRecord[];
  documentFieldEvidence: DocumentFieldEvidenceRecord[];
  documentReviewItems: DocumentReviewItemRecord[];
  extractionResults: ExtractionResultRecord[];
  extractionEvidence: ExtractionEvidenceRecord[];
  summaries: SummaryRecord[];
}
