import type { TierName } from "../runtime";

export const PRICING_PLAN_CONTRACT = [
  {
    name: "Basic",
    caption: "For creators getting started with active contract understanding and light operations",
  },
  {
    name: "Standard",
    caption: "For active solo creators managing multiple brand partnerships",
  },
  {
    name: "Premium",
    caption:
      "For power creators, managers, or creator businesses that want HelloBrand as an operational system",
  },
] as const;

export const TIER_SURFACE_CONTRACT: Record<
  TierName,
  {
    currentPlanHeading: string;
    recommendedUpgrade: "Standard" | "Premium" | null;
    analytics: "locked" | "full";
    inbox: "locked" | "full";
    settings: "locked" | "full";
    briefTab: "locked" | "full";
    emailsTab: "locked" | "full";
  }
> = {
  basic: {
    currentPlanHeading: "Basic plan",
    recommendedUpgrade: "Standard",
    analytics: "full",
    inbox: "locked",
    settings: "locked",
    briefTab: "locked",
    emailsTab: "locked",
  },
  standard: {
    currentPlanHeading: "Standard plan",
    recommendedUpgrade: "Premium",
    analytics: "full",
    inbox: "locked",
    settings: "locked",
    briefTab: "full",
    emailsTab: "locked",
  },
  premium: {
    currentPlanHeading: "Premium plan",
    recommendedUpgrade: null,
    analytics: "full",
    inbox: "full",
    settings: "full",
    briefTab: "full",
    emailsTab: "full",
  },
};
