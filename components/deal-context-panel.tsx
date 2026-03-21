import type { DealTermsRecord } from "@/lib/types";
import { humanizeToken } from "@/lib/utils";

interface DealContextPanelProps {
  terms: DealTermsRecord | null;
}

function ContextField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
        {label}
      </p>
      <p className="text-sm text-foreground">
        {value || <span className="text-black/35 dark:text-white/35">Not specified</span>}
      </p>
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
        <ContextField label="Brand" value={terms.brandName} />
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
            <ContextField label="Campaign" value={terms.campaignName} />
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
