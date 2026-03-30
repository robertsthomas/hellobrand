import { AssistantTriggerButton } from "@/components/assistant-trigger-button";
import { cleanDisplayText } from "@/lib/display-text";
import type { RiskFlagRecord } from "@/lib/types";
import { cn, normalizeEvidenceSnippet } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";

function cleanRiskEvidence(evidence: string[]) {
  return evidence
    .map((snippet) => normalizeEvidenceSnippet(snippet))
    .filter((snippet): snippet is string => Boolean(snippet));
}

export function RiskFlags({
  flags,
  dealId
}: {
  flags: RiskFlagRecord[];
  dealId?: string;
}) {
  const leadFlag = flags[0] ?? null;

  return (
    <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#161a1f] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            Watchouts
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
            These are creator-focused negotiation flags, not legal advice.
          </p>
        </div>
        {dealId && leadFlag ? (
          <AssistantTriggerButton
            label="Draft negotiation email"
            trigger={{
              kind: "risk_flag",
              sourceId: leadFlag.id,
              label: "Negotiate watchout",
              prompt: [
                `Draft a creator-professional negotiation email for this partnership that addresses this watchout: ${leadFlag.title}.`,
                leadFlag.suggestedAction
                  ? `Use this as the primary ask: ${leadFlag.suggestedAction}.`
                  : "Ask for a concrete revision or clarification.",
                "Keep it grounded in the saved workspace facts and avoid inventing prior agreements."
              ].join(" ")
            }}
          />
        ) : null}
      </div>
      {flags.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          defaultValue={flags[0]?.id}
          className="mt-6 border-t border-black/8 dark:border-white/10"
        >
          {flags.map((flag) => {
            const evidence = cleanRiskEvidence(flag.evidence);
            const title = cleanDisplayText(flag.title) ?? flag.title;
            const detail = cleanDisplayText(flag.detail) ?? flag.detail;
            const suggestedAction = cleanDisplayText(flag.suggestedAction);

            return (
              <AccordionItem key={flag.id} value={flag.id} className="border-black/8 dark:border-white/10">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="flex flex-wrap items-center gap-3 pr-6 text-left">
                    <h3 className="text-base font-semibold text-black/80 dark:text-white/85">
                      {title}
                    </h3>
                    <span
                      className={cn(
                        "border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                        flag.severity === "high" && "bg-clay/15 text-clay",
                        flag.severity === "medium" && "bg-ocean/10 text-ocean",
                        flag.severity === "low" && "bg-sage/15 text-sage"
                      )}
                    >
                      {flag.severity}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <div className="max-w-4xl space-y-4">
                    <p className="text-sm leading-6 text-black/65 dark:text-white/70">
                      {detail}
                    </p>
                    {suggestedAction ? (
                      <p className="text-sm font-medium text-black/75 dark:text-white/80">
                        Suggested action: {suggestedAction}
                      </p>
                    ) : null}
                    {evidence.length > 0 ? (
                      <details className="border border-black/8 px-4 py-3 dark:border-white/10">
                        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
                          Evidence ({Math.min(evidence.length, 2)})
                        </summary>
                        <div className="mt-3 divide-y divide-black/8 border border-black/8 dark:divide-white/10 dark:border-white/10">
                          {evidence.slice(0, 2).map((snippet, index) => (
                            <div
                              key={snippet}
                              className="px-3 py-3"
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
                                Evidence {index + 1}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-black/60 dark:text-white/65">
                                {snippet}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <div className="mt-6 border border-dashed border-black/10 px-4 py-4 text-sm text-black/60 dark:border-white/12 dark:text-white/65">
          No risk flags yet.
        </div>
      )}
    </section>
  );
}
