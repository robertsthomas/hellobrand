"use client";

import { Textarea } from "@/components/ui/textarea";
import { useIntakeUiStore } from "@/lib/stores/intake-ui-store";

export function IntakePasteFields() {
  const pastedText = useIntakeUiStore((state) => state.pastedText);
  const setPastedText = useIntakeUiStore((state) => state.setPastedText);

  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
        Paste anything from the brand
        <Textarea
          className="min-h-44 rounded-2xl border-black/10 bg-white px-4 py-3 text-sm dark:border-white/12 dark:bg-white/[0.04]"
          name="pastedText"
          value={pastedText}
          onChange={(event) => setPastedText(event.currentTarget.value)}
          placeholder="Paste a contract, email thread, brief, deliverables notes, or any brand context here."
        />
      </label>
      <p className="text-xs text-black/45 dark:text-white/45">
        Paste whatever you have. HelloBrand will sort contract language, email
        clarifications, briefs, and notes during analysis.
      </p>
    </div>
  );
}
