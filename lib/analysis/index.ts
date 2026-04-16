import { fallbackAnalyzeDocument } from "@/lib/analysis/fallback";
import { analyzeRisksWithLlm, generateSummaryWithLlm, hasLlmKey } from "@/lib/analysis/llm";
import { aiRiskAnalysisEnabled } from "@/flags";
import type { DocumentAnalysisResult, DocumentKind } from "@/lib/types";

export async function analyzeDocument(
  text: string,
  options?: { fileName?: string; documentKindHint?: DocumentKind | null }
): Promise<DocumentAnalysisResult> {
  const fallback = fallbackAnalyzeDocument(text, options);

  if (!hasLlmKey() || (await aiRiskAnalysisEnabled()) === false) {
    return fallback;
  }

  try {
    const shouldRunRiskLlm = fallback.classification.documentKind === "contract";
    const riskFlags = shouldRunRiskLlm
      ? await analyzeRisksWithLlm(
          text,
          fallback.classification.documentKind,
          fallback.extraction,
          fallback.riskFlags,
          "pending-document"
        )
      : fallback.riskFlags;
    const summary = await generateSummaryWithLlm(fallback.extraction, riskFlags, fallback.summary);

    return {
      ...fallback,
      riskFlags,
      summary,
    };
  } catch {
    return fallback;
  }
}
