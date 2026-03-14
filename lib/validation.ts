import { z } from "zod";

export const dealStatusValues = [
  "contract_received",
  "negotiating",
  "signed",
  "deliverables_pending",
  "submitted",
  "awaiting_payment",
  "paid",
  "completed"
] as const;

export const paymentStatusValues = [
  "not_invoiced",
  "invoiced",
  "awaiting_payment",
  "paid",
  "late"
] as const;

export const countersignStatusValues = ["unknown", "pending", "signed"] as const;

export const documentKindValues = [
  "contract",
  "deliverables_brief",
  "campaign_brief",
  "pitch_deck",
  "invoice",
  "email_thread",
  "unknown"
] as const;

export const createDealSchema = z.object({
  brandName: z.string().min(2).max(120),
  campaignName: z.string().min(2).max(120),
  notes: z.string().max(5000).nullable().optional()
});

export const updateDealSchema = z.object({
  brandName: z.string().min(2).max(120).optional(),
  campaignName: z.string().min(2).max(120).optional(),
  status: z.enum(dealStatusValues).optional(),
  paymentStatus: z.enum(paymentStatusValues).optional(),
  countersignStatus: z.enum(countersignStatusValues).optional()
});

const deliverableSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  dueDate: z.string().nullable(),
  channel: z.string().nullable(),
  quantity: z.number().nullable(),
  status: z
    .enum(["pending", "in_progress", "completed", "overdue"])
    .optional(),
  description: z.string().nullable().optional(),
  source: z.string().nullable().optional()
});

const timelineItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  date: z.string().nullable(),
  source: z.string().nullable(),
  status: z.enum(["pending", "scheduled", "completed", "unknown"])
});

const analyticsSchema = z.object({
  highlights: z.array(z.string())
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
  revisions: z.string().nullable(),
  revisionRounds: z.number().nullable(),
  termination: z.string().nullable(),
  terminationAllowed: z.boolean().nullable(),
  terminationNotice: z.string().nullable(),
  terminationConditions: z.string().nullable(),
  governingLaw: z.string().nullable(),
  notes: z.string().nullable()
});

export const draftIntentSchema = z.enum([
  "clarify-clause",
  "request-faster-payment",
  "limit-usage-rights",
  "clarify-deadline",
  "payment-reminder",
  "request-contract-revisions",
  "confirm-deliverables",
  "confirm-revised-brief"
]);

export const documentUploadSchema = z.object({
  dealId: z.string().min(1),
  pastedText: z.string().nullable().optional(),
  documentKindHint: z.enum(documentKindValues).nullable().optional()
});

export const intakeSessionStatusValues = [
  "draft",
  "uploading",
  "processing",
  "ready_for_confirmation",
  "failed",
  "completed",
  "expired"
] as const;

export const createIntakeSessionSchema = z.object({
  brandName: z.string().max(120).nullable().optional(),
  campaignName: z.string().max(120).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  pastedText: z.string().max(25000).nullable().optional()
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
  deliverables: z.array(deliverableSchema).optional().default([]),
  timelineItems: z.array(timelineItemSchema).optional().default([]),
  analytics: analyticsSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional()
});

export const paymentRecordInputSchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().max(12).nullable(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  paidDate: z.string().nullable(),
  status: z.enum(paymentStatusValues),
  notes: z.string().max(5000).nullable(),
  source: z.string().max(120).nullable().optional()
});

export const profileInputSchema = z.object({
  displayName: z.string().max(120).nullable(),
  creatorLegalName: z.string().max(120).nullable(),
  businessName: z.string().max(120).nullable(),
  contactEmail: z.string().email().nullable(),
  preferredSignature: z.string().max(200).nullable(),
  payoutDetails: z.string().max(5000).nullable()
});
