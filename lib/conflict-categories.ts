import type { DealCategory } from "@/lib/types";

export const CATEGORY_KEYWORDS: Record<DealCategory, string[]> = {
  beauty_personal_care: [
    "beauty",
    "skincare",
    "skin care",
    "makeup",
    "cosmetic",
    "haircare",
    "hair care",
    "personal care",
    "fragrance",
    "wellness beauty",
    "sephora",
    "ulta",
  ],
  fashion_apparel: [
    "fashion",
    "apparel",
    "clothing",
    "wardrobe",
    "denim",
    "handbag",
    "accessories",
    "shoe",
    "footwear",
    "style",
    "streetwear",
  ],
  food_beverage: [
    "food",
    "beverage",
    "drink",
    "snack",
    "meal",
    "restaurant",
    "coffee",
    "grocery",
    "protein bar",
    "lunchables",
    "cpg",
  ],
  entertainment_media: [
    "movie",
    "streaming",
    "series",
    "show",
    "film",
    "trailer",
    "episode",
    "netflix",
    "hulu",
    "disney+",
    "prime video",
  ],
  fitness_wellness: [
    "fitness",
    "wellness",
    "supplement",
    "gym",
    "workout",
    "recovery",
    "pilates",
    "nutrition",
    "running",
  ],
  parenting_family: [
    "parenting",
    "family",
    "baby",
    "toddler",
    "kids",
    "children",
    "mom",
    "maternal",
  ],
  tech_gaming: [
    "tech",
    "gaming",
    "software",
    "app",
    "mobile game",
    "console",
    "pc",
    "laptop",
    "phone",
    "creator tool",
  ],
  travel_hospitality: [
    "travel",
    "hotel",
    "airline",
    "resort",
    "tourism",
    "vacation",
    "destination",
    "booking",
    "carry-on",
    "carry on",
    "luggage",
    "suitcase",
    "weekender",
  ],
  finance: [
    "finance",
    "bank",
    "credit card",
    "insurance",
    "investment",
    "fintech",
    "tax",
    "crypto",
  ],
  home_lifestyle: [
    "home",
    "furniture",
    "decor",
    "kitchen",
    "appliance",
    "mattress",
    "cleaning",
    "lifestyle",
  ],
  retail_ecommerce: [
    "retail",
    "ecommerce",
    "marketplace",
    "shopping",
    "subscription box",
    "storewide",
    "shop now",
  ],
  sports_outdoors: [
    "sports",
    "outdoors",
    "athletic",
    "trail",
    "camping",
    "hiking",
    "cycling",
    "golf",
    "pickleball",
  ],
  other: [],
};

export const CATEGORY_LABELS: Record<DealCategory, string> = {
  beauty_personal_care: "Beauty & personal care",
  fashion_apparel: "Fashion & apparel",
  food_beverage: "Food & beverage",
  entertainment_media: "Entertainment & media",
  fitness_wellness: "Fitness & wellness",
  parenting_family: "Parenting & family",
  tech_gaming: "Tech & gaming",
  travel_hospitality: "Travel & hospitality",
  finance: "Finance",
  home_lifestyle: "Home & lifestyle",
  retail_ecommerce: "Retail & ecommerce",
  sports_outdoors: "Sports & outdoors",
  other: "Other",
};

export const dealCategoryOptions = Object.keys(CATEGORY_LABELS) as DealCategory[];

export function dealCategoryLabel(category: DealCategory | null | undefined) {
  return category ? CATEGORY_LABELS[category] : null;
}

function normalizeWhitespace(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textContainsKeyword(text: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedKeyword.includes(" ")) {
    return text.includes(normalizedKeyword);
  }

  const pattern = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, "i");
  return pattern.test(text);
}

function scoreCategory(text: string, category: DealCategory) {
  const lower = text.toLowerCase();
  return CATEGORY_KEYWORDS[category].reduce((score, keyword) => {
    if (textContainsKeyword(lower, keyword)) {
      return score + Math.max(1, keyword.split(" ").length);
    }
    return score;
  }, 0);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeWhitespace(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

export function normalizeDealCategory(value: string | null | undefined): DealCategory | null {
  const normalized = normalizeWhitespace(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  for (const category of Object.keys(CATEGORY_KEYWORDS) as DealCategory[]) {
    if (category === "other") {
      continue;
    }

    if (scoreCategory(normalized, category) > 0) {
      return category;
    }
  }

  return null;
}

function inferDealCategoryFromLabels(
  values: Array<string | null | undefined>
): DealCategory | null {
  const combined = uniqueStrings(values).join("\n");
  if (!combined) {
    return null;
  }

  let bestCategory: DealCategory | null = null;
  let bestScore = 0;

  for (const category of Object.keys(CATEGORY_KEYWORDS) as DealCategory[]) {
    if (category === "other") {
      continue;
    }

    const score = scoreCategory(combined, category);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}
