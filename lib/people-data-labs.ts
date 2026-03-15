import { inferDealCategoryFromLabels } from "@/lib/conflict-intelligence";
import { startServerDebug } from "@/lib/server-debug";
import type { DealCategory } from "@/lib/types";

interface PdlCompanyEnrichmentResponse {
  status?: number;
  name?: string | null;
  display_name?: string | null;
  website?: string | null;
  industry?: string | null;
  industry_v2?: string | null;
  summary?: string | null;
  description?: string | null;
  type?: string | null;
  likelihood?: number | null;
}

export interface CompanyCategoryEnrichment {
  source: "people_data_labs";
  brandName: string;
  companyName: string | null;
  website: string | null;
  industry: string | null;
  industryV2: string | null;
  category: DealCategory | null;
  confidence: number;
  snippet: string | null;
}

function hasPeopleDataLabsKey() {
  return Boolean(process.env.PEOPLE_DATA_LABS_API_KEY);
}

function buildSnippet(result: Omit<CompanyCategoryEnrichment, "snippet">) {
  const labels = [result.industryV2, result.industry].filter(Boolean).join(" / ");
  if (!labels && !result.website) {
    return null;
  }

  const parts = [
    `${result.brandName} matched People Data Labs company data`,
    labels ? `(${labels})` : null,
    result.website ? `at ${result.website}` : null
  ].filter(Boolean);

  return `${parts.join(" ")}.`;
}

export async function enrichBrandCategoryWithPeopleDataLabs(
  brandName: string | null | undefined
): Promise<CompanyCategoryEnrichment | null> {
  const normalizedBrand = typeof brandName === "string" ? brandName.trim() : "";
  if (!normalizedBrand || !hasPeopleDataLabsKey()) {
    return null;
  }

  const debug = startServerDebug("people_data_labs_company_enrich", {
    brandName: normalizedBrand
  });

  try {
    const url = new URL("https://api.peopledatalabs.com/v5/company/enrich");
    url.searchParams.set("name", normalizedBrand);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Api-Key": process.env.PEOPLE_DATA_LABS_API_KEY as string
      },
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as
      | PdlCompanyEnrichmentResponse
      | null;

    if (!response.ok || !payload) {
      throw new Error(
        payload && typeof payload.status === "number"
          ? `PDL request failed with status ${payload.status}`
          : "PDL request failed."
      );
    }

    const category = inferDealCategoryFromLabels([
      payload.industry_v2,
      payload.industry,
      payload.summary,
      payload.description,
      payload.type
    ]);
    const confidence =
      typeof payload.likelihood === "number"
        ? Math.max(0, Math.min(1, Number(payload.likelihood)))
        : category
          ? 0.72
          : 0;

    const partial = {
      source: "people_data_labs" as const,
      brandName: normalizedBrand,
      companyName: payload.display_name ?? payload.name ?? null,
      website: payload.website ?? null,
      industry: payload.industry ?? null,
      industryV2: payload.industry_v2 ?? null,
      category,
      confidence
    };

    const result: CompanyCategoryEnrichment = {
      ...partial,
      snippet: buildSnippet(partial)
    };

    debug.complete({
      companyName: result.companyName,
      website: result.website,
      industry: result.industry,
      industryV2: result.industryV2,
      category: result.category,
      confidence: result.confidence
    });

    return result;
  } catch (error) {
    debug.fail(error);
    return null;
  }
}
