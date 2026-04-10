/**
 * Intake session, normalization, and batch clustering record types.
 * Keep route handlers, upload adapters, and document persistence logic out of this module.
 */

import type { DealCategory, CampaignDateWindow, DealRecord, DeliverableItem, DisclosureObligation } from "./deals";
import type { JobType } from "./documents";

export type IntakeProcessingStageId =
  | "extracting"
  | "structuring"
  | "risk_review"
  | "summary";

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
  isRunning: boolean;
}

export interface IntakeDraftListItem {
  session: IntakeSessionRecord;
  deal: Pick<DealRecord, "id" | "brandName" | "campaignName" | "updatedAt">;
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
