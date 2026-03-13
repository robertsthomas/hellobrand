import type { RiskFlagRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RiskFlags({ flags }: { flags: RiskFlagRecord[] }) {
  return (
    <section className="rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-ocean">Watchouts</h2>
          <p className="mt-2 max-w-2xl text-sm text-black/60 dark:text-white/65">
            These are creator-focused negotiation flags, not legal advice.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        {flags.map((flag) => (
          <article
            key={flag.id}
            className="rounded-[1.5rem] border border-black/5 dark:border-white/10 bg-sand/50 dark:bg-white/[0.05] p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-semibold text-black/80 dark:text-white/85">{flag.title}</h3>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                  flag.severity === "high" && "bg-clay/15 text-clay",
                  flag.severity === "medium" && "bg-ocean/10 text-ocean",
                  flag.severity === "low" && "bg-sage/15 text-sage"
                )}
              >
                {flag.severity}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-black/65 dark:text-white/70">{flag.detail}</p>
            {flag.suggestedAction ? (
              <p className="mt-3 text-sm font-medium text-black/75 dark:text-white/80">
                Suggested action: {flag.suggestedAction}
              </p>
            ) : null}
            {flag.evidence.length > 0 ? (
              <div className="mt-3 rounded-[1.25rem] bg-white/80 dark:bg-white/5 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
                  Evidence
                </p>
                <div className="mt-2 space-y-2">
                  {flag.evidence.slice(0, 2).map((snippet) => (
                    <p key={snippet} className="text-xs leading-5 text-black/60 dark:text-white/65">
                      {snippet}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
