import { z } from "zod";

export const dealStatusValues = [
  "contract_received",
  "negotiating",
  "signed",
  "deliverables_pending",
  "submitted",
  "awaiting_payment",
  "paid",
  "completed",
] as const;

export const paymentStatusValues = [
  "not_invoiced",
  "invoiced",
  "awaiting_payment",
  "paid",
  "late",
] as const;

export const invoiceStatusValues = ["draft", "finalized", "sent", "voided"] as const;

export const countersignStatusValues = ["unknown", "pending", "signed"] as const;
export const dealCategoryValues = [
  "beauty_personal_care",
  "fashion_apparel",
  "food_beverage",
  "entertainment_media",
  "fitness_wellness",
  "parenting_family",
  "tech_gaming",
  "travel_hospitality",
  "finance",
  "home_lifestyle",
  "retail_ecommerce",
  "sports_outdoors",
  "other",
] as const;

export const documentKindValues = [
  "contract",
  "deliverables_brief",
  "campaign_brief",
  "pitch_deck",
  "invoice",
  "email_thread",
  "unknown",
] as const;

export const createDealSchema = z.object({
  brandName: z.string().min(2).max(120),
  campaignName: z.string().min(2).max(120),
  notes: z.string().max(5000).nullable().optional(),
});

export const updateDealSchema = z.object({
  brandName: z.string().min(2).max(120).optional(),
  campaignName: z.string().min(2).max(120).optional(),
  status: z.enum(dealStatusValues).optional(),
  paymentStatus: z.enum(paymentStatusValues).optional(),
  countersignStatus: z.enum(countersignStatusValues).optional(),
});

const deliverableSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  dueDate: z.string().nullable(),
  channel: z.string().nullable(),
  quantity: z.number().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
  description: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

const timelineItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  date: z.string().nullable(),
  source: z.string().nullable(),
  status: z.enum(["pending", "scheduled", "completed", "unknown"]),
});

const analyticsSchema = z.object({
  highlights: z.array(z.string()),
});

const campaignDateWindowSchema = z.object({
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  postingWindow: z.string().nullable(),
});

const disclosureObligationSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  detail: z.string().min(1),
  source: z.string().nullable(),
});

export const dealTermsInputSchema = z.object({
  brandName: z.string().nullable(),
  agencyName: z.string().nullable(),
  creatorName: z.string().nullable(),
  campaignName: z.string().nullable(),
  paymentAmount: z.number().nullable(),
  currency: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  paymentStructure: z.string().nullable(),
  netTermsDays: z.number().nullable(),
  paymentTrigger: z.string().nullable(),
  deliverables: z.array(deliverableSchema),
  usageRights: z.string().nullable(),
  usageRightsOrganicAllowed: z.boolean().nullable(),
  usageRightsPaidAllowed: z.boolean().nullable(),
  whitelistingAllowed: z.boolean().nullable(),
  usageDuration: z.string().nullable(),
  usageTerritory: z.string().nullable(),
  usageChannels: z.array(z.string()),
  exclusivity: z.string().nullable(),
  exclusivityApplies: z.boolean().nullable(),
  exclusivityCategory: z.string().nullable(),
  exclusivityDuration: z.string().nullable(),
  exclusivityRestrictions: z.string().nullable(),
  brandCategory: z.enum(dealCategoryValues).nullable().optional(),
  competitorCategories: z.array(z.string()).optional().default([]),
  restrictedCategories: z.array(z.string()).optional().default([]),
  campaignDateWindow: campaignDateWindowSchema.nullable().optional(),
  disclosureObligations: z.array(disclosureObligationSchema).optional().default([]),
  revisions: z.string().nullable(),
  revisionRounds: z.number().nullable(),
  termination: z.string().nullable(),
  terminationAllowed: z.boolean().nullable(),
  terminationNotice: z.string().nullable(),
  terminationConditions: z.string().nullable(),
  governingLaw: z.string().nullable(),
  notes: z.string().nullable(),
});

export const assistantScopeValues = ["user", "deal"] as const;
export const assistantDealTabValues = [
  "overview",
  "terms",
  "risks",
  "deliverables",
  "brief",
  "emails",
  "documents",
  "invoices",
  "notes",
] as const;
export const assistantTriggerKindValues = [
  "risk_flag",
  "payment",
  "deliverable",
  "approval",
  "deal_context",
  "email",
  "general",
] as const;

export const assistantTriggerSchema = z.object({
  kind: z.enum(assistantTriggerKindValues),
  sourceId: z.string().nullable(),
  prompt: z.string().max(2000).nullable(),
  label: z.string().max(120).nullable(),
});

export const assistantToneValues = ["professional", "friendly", "direct", "warm"] as const;

export const assistantPageContextSchema = z.object({
  purpose: z.string().min(1).max(500),
  availableActions: z.array(z.string().max(200)).max(20),
  dataHints: z.array(z.string().max(300)).max(20),
});

export const assistantClientContextSchema = z.object({
  pathname: z.string().min(1).max(500),
  pageTitle: z.string().min(1).max(120),
  dealId: z.string().nullable(),
  tab: z.enum(assistantDealTabValues).nullable(),
  profileLocation: z.string().max(160).nullable(),
  trigger: assistantTriggerSchema.nullable(),
  tone: z.enum(assistantToneValues),
  pageContext: assistantPageContextSchema.nullable(),
});

export const assistantThreadCreateSchema = z.object({
  scope: z.enum(assistantScopeValues),
  dealId: z.string().nullable().optional(),
  title: z.string().max(160).nullable().optional(),
  context: assistantClientContextSchema,
});

export const assistantChatRequestSchema = z.object({
  id: z.string().nullable().optional(),
  threadId: z.string().min(1),
  scope: z.enum(assistantScopeValues),
  dealId: z.string().nullable(),
  context: assistantClientContextSchema,
  messages: z.array(z.any()).min(1).max(40),
  messageId: z.string().nullable().optional(),
});

export const documentUploadSchema = z.object({
  dealId: z.string().min(1),
  pastedText: z.string().nullable().optional(),
  documentKindHint: z.enum(documentKindValues).nullable().optional(),
});

export const intakeSessionStatusValues = [
  "draft",
  "queued",
  "uploading",
  "processing",
  "ready_for_confirmation",
  "failed",
  "completed",
  "expired",
] as const;

export const createIntakeSessionSchema = z.object({
  brandName: z.string().max(120).nullable().optional(),
  campaignName: z.string().max(120).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  pastedText: z.string().max(25000).nullable().optional(),
});

export const confirmIntakeSessionSchema = z.object({
  brandName: z.string().min(2).max(120),
  contractTitle: z.string().min(2).max(160),
  agencyName: z.string().max(120).nullable().optional(),
  contractSummary: z.string().max(12000).nullable().optional(),
  primaryContactOrganizationType: z.enum(["brand", "agency"]).nullable().optional(),
  primaryContactName: z.string().max(120).nullable().optional(),
  primaryContactTitle: z.string().max(160).nullable().optional(),
  primaryContactEmail: z.string().email().nullable().optional(),
  primaryContactPhone: z.string().max(40).nullable().optional(),
  paymentAmount: z.number().nullable().optional(),
  currency: z.string().max(12).nullable().optional(),
  brandCategory: z.enum(dealCategoryValues).nullable().optional(),
  competitorCategories: z.array(z.string().min(1).max(120)).optional().default([]),
  restrictedCategories: z.array(z.string().min(1).max(120)).optional().default([]),
  campaignDateWindow: campaignDateWindowSchema.nullable().optional(),
  disclosureObligations: z.array(disclosureObligationSchema).optional().default([]),
  deliverables: z.array(deliverableSchema).optional().default([]),
  timelineItems: z.array(timelineItemSchema).optional().default([]),
  analytics: analyticsSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const paymentRecordInputSchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().max(12).nullable(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  paidDate: z.string().nullable(),
  status: z.enum(paymentStatusValues),
  notes: z.string().max(5000).nullable(),
  source: z.string().max(120).nullable().optional(),
});

export const invoicePartySchema = z.object({
  name: z.string().max(160),
  email: z.string().email().nullable(),
  companyName: z.string().max(160).nullable(),
  address: z.string().max(1000).nullable(),
  taxId: z.string().max(80).nullable(),
  payoutDetails: z.string().max(1000).nullable(),
});

export const invoiceLineItemSchema = z.object({
  id: z.string(),
  deliverableId: z.string().nullable(),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).nullable(),
  channel: z.string().max(120).nullable(),
  quantity: z.number().positive(),
  unitRate: z.number().min(0),
  amount: z.number().min(0),
});

export const invoiceRecordInputSchema = z.object({
  invoiceNumber: z.string().min(1).max(80),
  status: z.enum(invoiceStatusValues).optional(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  currency: z.string().max(12).nullable(),
  subtotal: z.number().min(0).nullable(),
  notes: z.string().max(5000).nullable(),
  billTo: invoicePartySchema,
  issuer: invoicePartySchema,
  lineItems: z.array(invoiceLineItemSchema).min(1),
  pdfDocumentId: z.string().nullable().optional(),
  manualNumberOverride: z.boolean().optional(),
});

export const onboardingProfileSubmitSchema = z.object({
  displayName: z.string().min(1, "Name is required.").max(120),
  contactEmail: z.string().email("Valid email is required."),
  timeZone: z.string().max(100).nullable().optional(),
  primaryHandle: z.string().min(1, "Handle is required.").max(120),
  selectedPlatforms: z.array(z.string().min(1)).min(1, "Select at least one platform."),
  platformHandles: z.record(z.string(), z.string().max(120)),
  contentCategory: z.string().min(1, "Content category is required.").max(120),
  bio: z.string().max(500).nullable().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export const onboardingGuideUpdateSchema = z.object({
  stepId: z.string().min(1),
  action: z.enum(["dismiss", "complete"]),
});

export const profileInputSchema = z.object({
  displayName: z.string().max(120).nullable(),
  creatorLegalName: z.string().max(120).nullable(),
  businessName: z.string().max(120).nullable(),
  contactEmail: z.string().email().nullable(),
  timeZone: z.string().max(100).nullable().optional(),
  preferredSignature: z.string().max(200).nullable(),
  payoutDetails: z.string().max(5000).nullable(),
  defaultCurrency: z.string().max(12).nullable().optional(),
  reminderLeadDays: z.number().int().min(0).max(30).nullable().optional(),
  conflictAlertsEnabled: z.boolean().optional(),
  paymentRemindersEnabled: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  productUpdatesEnabled: z.boolean().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export const feedbackSubmissionSchema = z.object({
  score: z.number().int().min(1).max(5),
  message: z.string().max(2000).nullable(),
  pagePath: z.string().min(1).max(500),
  pageTitle: z.string().min(1).max(120),
  dealId: z.string().max(120).nullable().optional(),
  requestedFollowUp: z.boolean().optional().default(false),
});

export const publicFunnelEventNames = [
  "landing_upload_cta_clicked",
  "landing_sample_cta_clicked",
  "sample_scroll_depth",
  "sample_upload_cta_clicked",
  "anonymous_upload_started",
  "anonymous_upload_succeeded",
  "anonymous_upload_failed",
  "anonymous_save_cta_clicked",
  "anonymous_create_free_workspace_clicked",
  "anonymous_auth_returned",
  "anonymous_claim_succeeded",
  "anonymous_claim_failed",
] as const;

export const publicFunnelEventSchema = z.object({
  name: z.enum(publicFunnelEventNames),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  distinctId: z.string().min(1).max(200).nullable().optional(),
  currentUrl: z.string().url().nullable().optional(),
});
