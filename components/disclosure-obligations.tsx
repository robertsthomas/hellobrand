import { BadgeCheck } from "lucide-react";

import { AssistantTriggerButton } from "@/components/assistant-trigger-button";
import type { DisclosureObligation } from "@/lib/types";
import { sanitizePlainTextInput } from "@/lib/utils";

export function DisclosureObligations({
  obligations,
  title = "Disclosure and approval reminders",
  dealId
}: {
  obligations: DisclosureObligation[];
  title?: string;
  dealId?: string;
}) {
  if (obligations.length === 0) {
    return null;
  }

  return (
    <section className="border border-black/6 bg-white/80 p-5 dark:border-white/8 dark:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {dealId ? (
          <AssistantTriggerButton
            label="Clarify approval flow"
            trigger={{
              kind: "approval",
              sourceId: dealId,
              label: "Clarify approvals",
              prompt: `Draft a concise creator-professional email clarifying the approval and disclosure workflow for this partnership. Ask the brand to confirm review timing, mandatory approvals, and any non-negotiable disclosure requirements. Focus on: ${obligations
                .slice(0, 3)
                .map((obligation) => obligation.title)
                .join(", ")}.`
            }}
          />
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {obligations.slice(0, 4).map((obligation, index) => (
          <div
            key={`${obligation.id}-${index}`}
            className="bg-sand/45 px-4 py-3 dark:bg-white/[0.04]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-sage/10 p-2 text-sage">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink">
                  {sanitizePlainTextInput(obligation.title)}
                </div>
                <p className="mt-1 text-sm text-black/60 dark:text-white/65">
                  {sanitizePlainTextInput(obligation.detail)}
                </p>
                {obligation.source ? (
                  <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                    {sanitizePlainTextInput(obligation.source)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
