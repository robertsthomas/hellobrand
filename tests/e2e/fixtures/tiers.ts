import type { TierName } from "../runtime";

export const PRICING_PLAN_CONTRACT = [
  {
    name: "Free",
    caption: "For creators validating value on one real brand partnership",
  },
  {
    name: "Basic",
    caption: "For creators managing active brand work without needing a synced inbox yet",
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
    recommendedUpgrade: "Basic" | "Premium" | null;
    analytics: "locked" | "full";
    inbox: "locked" | "full";
    settings: "locked" | "full";
    briefTab: "locked" | "full";
    emailsTab: "locked" | "full";
  }
> = {
  free: {
    currentPlanHeading: "Free plan",
    recommendedUpgrade: "Basic",
    analytics: "locked",
    inbox: "locked",
    settings: "locked",
    briefTab: "locked",
    emailsTab: "locked",
  },
  basic: {
    currentPlanHeading: "Basic plan",
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
