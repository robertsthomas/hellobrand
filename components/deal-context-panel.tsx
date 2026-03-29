import type { DealTermsRecord } from "@/lib/types";
import { stripInlineMarkdown } from "@/lib/deal-summary";
import { humanizeToken } from "@/lib/utils";

interface DealContextPanelProps {
  terms: DealTermsRecord | null;
}

function cleanContextValue(
  value: string | null | undefined,
  kind: "brand" | "campaign" | "generic" = "generic"
) {
  if (!value) {
    return null;
  }

  const segments = value
    .trim()
    .split(/\s+#{1,6}\s+|\n\s*#{1,6}\s*|\n{2,}/g)
    .map((segment) => stripInlineMarkdown(segment).trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  if (kind === "brand") {
    return segments[0] ?? null;
  }

  if (kind === "campaign") {
    return segments[segments.length - 1] ?? null;
  }

  return segments.join(" ");
}

function ContextField({
  label,
  value,
  kind = "generic"
}: {
  label: string;
  value: string | null | undefined;
  kind?: "brand" | "campaign" | "generic";
}) {
  const cleanedValue = cleanContextValue(value, kind);

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
        {label}
      </p>
      {cleanedValue ? (
        <p className="text-sm leading-6 text-foreground">{cleanedValue}</p>
      ) : (
        <p className="text-sm text-black/35 dark:text-white/35">Not specified</p>
      )}
    </div>
  );
}

export function DealContextPanel({ terms }: DealContextPanelProps) {
  if (!terms) return null;

  const hasContext =
    terms.brandName || terms.agencyName || terms.creatorName || terms.brandCategory;

  if (!hasContext) return null;

  return (
    <div className="space-y-6 border border-black/8 bg-white px-6 py-6 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3] dark:text-white/42">
        Partnership context
      </p>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ContextField label="Brand" value={terms.brandName} kind="brand" />
        <ContextField label="Agency" value={terms.agencyName} />
        <ContextField label="Creator" value={terms.creatorName} />
        <ContextField
          label="Category"
          value={terms.brandCategory ? humanizeToken(terms.brandCategory) : null}
        />
      </div>

      {(terms.exclusivityApplies || terms.campaignDateWindow) && (
        <div className="grid gap-6 border-t border-black/8 pt-6 md:grid-cols-2 xl:grid-cols-4 dark:border-white/10">
          {terms.campaignName && (
            <ContextField label="Campaign" value={terms.campaignName} kind="campaign" />
          )}
          {terms.campaignDateWindow?.startDate && (
            <ContextField label="Campaign Start" value={terms.campaignDateWindow.startDate} />
          )}
          {terms.campaignDateWindow?.endDate && (
            <ContextField label="Campaign End" value={terms.campaignDateWindow.endDate} />
          )}
          {terms.governingLaw && (
            <ContextField label="Governing Law" value={terms.governingLaw} />
          )}
        </div>
      )}
    </div>
  );
}
