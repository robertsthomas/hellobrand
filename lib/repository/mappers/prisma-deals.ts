/**
 * Prisma mappers for deals, terms, drafts, and risk flags.
 * These helpers keep deal-related row conversion out of the repository implementation.
 */

import { normalizeDealCategory } from "@/lib/conflict-intelligence";
import type { DealRecord, DealTermsRecord, RiskFlagRecord } from "@/lib/types";

import { iso, toStringArray } from "./prisma-shared";

export function toDealRecord(deal: {
  id: string;
  userId: string;
  brandName: string;
  campaignName: string;
  status: string;
  statusBeforeArchive: string | null;
  paymentStatus: string;
  countersignStatus: string;
  summary: string | null;
  legalDisclaimer: string;
  nextDeliverableDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  analyzedAt: Date | null;
  confirmedAt: Date | null;
  esignEnvelopeId: string | null;
  esignStatus: string | null;
  esignUpdatedAt: Date | null;
}): DealRecord {
  return {
    ...deal,
    nextDeliverableDate: iso(deal.nextDeliverableDate),
    createdAt: iso(deal.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(deal.updatedAt) ?? new Date().toISOString(),
    analyzedAt: iso(deal.analyzedAt),
    confirmedAt: iso(deal.confirmedAt),
    esignUpdatedAt: iso(deal.esignUpdatedAt),
  } as DealRecord;
}

export function toDealTermsRecord(terms: {
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
  deliverables: unknown;
  usageRights: string | null;
  usageRightsOrganicAllowed: boolean | null;
  usageRightsPaidAllowed: boolean | null;
  whitelistingAllowed: boolean | null;
  usageDuration: string | null;
  usageTerritory: string | null;
  usageChannels: unknown;
  exclusivity: string | null;
  exclusivityApplies: boolean | null;
  exclusivityCategory: string | null;
  exclusivityDuration: string | null;
  exclusivityRestrictions: string | null;
  brandCategory: string | null;
  competitorCategories: unknown;
  restrictedCategories: unknown;
  campaignDateWindow: unknown;
  disclosureObligations: unknown;
  revisions: string | null;
  revisionRounds: number | null;
  termination: string | null;
  terminationAllowed: boolean | null;
  terminationNotice: string | null;
  terminationConditions: string | null;
  governingLaw: string | null;
  notes: string | null;
  manuallyEditedFields: unknown;
  briefData: unknown;
  pendingExtraction: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DealTermsRecord {
  return {
    ...terms,
    deliverables: Array.isArray(terms.deliverables)
      ? (terms.deliverables as DealTermsRecord["deliverables"])
      : [],
    usageChannels: toStringArray(terms.usageChannels),
    brandCategory: normalizeDealCategory(terms.brandCategory),
    competitorCategories: toStringArray(terms.competitorCategories),
    restrictedCategories: toStringArray(terms.restrictedCategories),
    campaignDateWindow:
      terms.campaignDateWindow && typeof terms.campaignDateWindow === "object"
        ? (terms.campaignDateWindow as DealTermsRecord["campaignDateWindow"])
        : null,
    disclosureObligations: Array.isArray(terms.disclosureObligations)
      ? (terms.disclosureObligations as DealTermsRecord["disclosureObligations"])
      : [],
    manuallyEditedFields: toStringArray(terms.manuallyEditedFields),
    briefData:
      terms.briefData && typeof terms.briefData === "object"
        ? (terms.briefData as DealTermsRecord["briefData"])
        : null,
    pendingExtraction:
      terms.pendingExtraction && typeof terms.pendingExtraction === "object"
        ? (terms.pendingExtraction as DealTermsRecord["pendingExtraction"])
        : null,
    createdAt: iso(terms.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(terms.updatedAt) ?? new Date().toISOString(),
  };
}

export function toRiskFlagRecord(flag: {
  id: string;
  dealId: string;
  category: string;
  title: string;
  detail: string;
  severity: string;
  suggestedAction: string | null;
  evidence: unknown;
  sourceDocumentId: string | null;
  sourceType?: string | null;
  sourceMessageId?: string | null;
  createdAt: Date;
}): RiskFlagRecord {
  return {
    ...flag,
    category: flag.category as RiskFlagRecord["category"],
    severity: flag.severity as RiskFlagRecord["severity"],
    evidence: toStringArray(flag.evidence),
    sourceType: (flag.sourceType as RiskFlagRecord["sourceType"]) ?? null,
    sourceMessageId: flag.sourceMessageId ?? null,
    createdAt: iso(flag.createdAt) ?? new Date().toISOString(),
  };
}
