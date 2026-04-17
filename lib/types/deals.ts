/**
 * Deal, terms, brief, conflict, and workspace-facing record types.
 * Keep document pipeline step state, inbox sync state, and persistence adapters out of this module.
 */

import type { PaymentStatus } from "./billing";

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

type CountersignStatus = "unknown" | "pending" | "signed";

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

type ConflictType =
  | "category_conflict"
  | "competitor_restriction"
  | "exclusivity_overlap"
  | "schedule_collision";

type ConflictLevel = "hard_conflict" | "warning" | "informational";

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

export interface BriefData {
  campaignOverview: string | null;
  campaignCode?: string | null;
  jobNumber?: string | null;
  referenceId?: string | null;
  campaignObjective?: string | null;
  messagingPoints: string[];
  talkingPoints: string[];
  creativeConceptOverview: string | null;
  contentPillars?: string[];
  requiredElements?: string[];
  requiredClaims?: string[];
  brandGuidelines: string | null;
  approvalRequirements: string | null;
  revisionRequirements?: string | null;
  targetAudience: string | null;
  toneAndStyle: string | null;
  visualDirection?: string | null;
  doNotMention: string[];
  productName?: string | null;
  productDescription?: string | null;
  deliverablesSummary?: string | null;
  deliverablePlatforms?: string[];
  creatorHandle?: string | null;
  postingSchedule?: string | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  executionTargetDate?: string | null;
  conceptDueDate?: string | null;
  campaignLiveDate?: string | null;
  campaignFlight?: string | null;
  draftDueDate?: string | null;
  contentDueDate?: string | null;
  postDuration?: string | null;
  amplificationPeriod?: string | null;
  usageNotes?: string | null;
  disclosureRequirements?: string[];
  competitorRestrictions?: string[];
  linksAndAssets?: string[];
  promoCode?: string | null;
  paymentSchedule?: string | null;
  paymentRequirements?: string | null;
  paymentNotes?: string | null;
  reportingRequirements?: string | null;
  campaignNotes?: string | null;
  brandContactName?: string | null;
  brandContactTitle?: string | null;
  brandContactEmail?: string | null;
  brandContactPhone?: string | null;
  agencyContactName?: string | null;
  agencyContactTitle?: string | null;
  agencyContactEmail?: string | null;
  agencyContactPhone?: string | null;
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

type RiskFlagSourceType = "document" | "email";

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

export type DraftIntent =
  | "clarify-clause"
  | "request-faster-payment"
  | "limit-usage-rights"
  | "clarify-deadline"
  | "payment-reminder"
  | "request-contract-revisions"
  | "confirm-deliverables"
  | "confirm-revised-brief";
