import type { RiskFlagRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";

export function RiskFlags({ flags }: { flags: RiskFlagRecord[] }) {
  return (
    <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Watchouts
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
            These are creator-focused negotiation flags, not legal advice.
          </p>
        </div>
      </div>
      {flags.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          defaultValue={flags[0]?.id}
          className="mt-6 border-t border-black/8 dark:border-white/10"
        >
          {flags.map((flag) => (
            <AccordionItem
              key={flag.id}
              value={flag.id}
              className="border-black/8 dark:border-white/10"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex flex-wrap items-center gap-3 pr-6 text-left">
                  <h3 className="text-base font-semibold text-black/80 dark:text-white/85">
                    {flag.title}
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
                    {flag.detail}
                  </p>
                  {flag.suggestedAction ? (
                    <p className="text-sm font-medium text-black/75 dark:text-white/80">
                      Suggested action: {flag.suggestedAction}
                    </p>
                  ) : null}
                  {flag.evidence.length > 0 ? (
                    <div className="border border-black/8 px-4 py-3 dark:border-white/10">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
                        Evidence
                      </p>
                      <div className="mt-2 space-y-2">
                        {flag.evidence.slice(0, 2).map((snippet) => (
                          <p
                            key={snippet}
                            className="text-xs leading-5 text-black/60 dark:text-white/65"
                          >
                            {snippet}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="mt-6 border border-dashed border-black/10 px-4 py-4 text-sm text-black/60 dark:border-white/12 dark:text-white/65">
          No risk flags yet.
        </div>
      )}
    </section>
  );
}
