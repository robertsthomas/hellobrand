import { dealCategoryOptions } from "@/lib/conflict-categories";
import type { DealCategory } from "@/lib/types";

export const DEAL_CATEGORY_OPTIONS: DealCategory[] = [...dealCategoryOptions];

export const CURRENCY_OPTIONS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "SGD",
  "HKD",
  "BRL",
  "MXN",
  "INR",
  "KRW",
  "ZAR",
  "AED",
  "PLN",
  "CZK",
  "ILS",
  "THB",
  "PHP",
  "MYR",
  "IDR",
  "TWD",
  "VND",
  "CLP",
  "COP",
  "PEN",
  "ARS",
] as const;

export const DEAL_REVIEW_SECTION_FIELDS = {
  partnership: ["brandName", "campaignName", "creatorName", "agencyName", "brandCategory"],
  payment: ["paymentAmount", "paymentTerms"],
  deliverables: ["deliverables"],
  usage: ["usageRights"],
  exclusivity: ["exclusivity", "exclusivityRestrictions"],
  termination: ["termination", "governingLaw"],
} as const;

export const DEAL_FIELD_LABELS: Record<string, string> = {
  brandName: "Brand name",
  campaignName: "Campaign name",
  creatorName: "Creator name",
  agencyName: "Agency name",
  brandCategory: "Brand category",
  paymentAmount: "Payment amount",
  paymentTerms: "Payment terms",
  deliverables: "Deliverables",
  usageRights: "Usage rights summary",
  exclusivity: "Exclusivity summary",
  exclusivityRestrictions: "Restricted categories",
  termination: "Termination summary",
  governingLaw: "Governing law",
};
