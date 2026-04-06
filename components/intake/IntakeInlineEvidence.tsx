import type { IntakeEvidenceGroup } from "@/lib/types";
import { stripHtmlTags } from "@/lib/utils";

export function IntakeInlineEvidence({
  groups,
  ids
}: {
  groups: IntakeEvidenceGroup[];
  ids: string[];
}) {
  const matching = groups.filter((group) => ids.includes(group.id));
  if (matching.length === 0) {
    return null;
  }

  const snippets = matching.flatMap((group) => group.snippets);
  if (snippets.length === 0) {
    return null;
  }

  return (
    <details className="mt-4 border border-black/5 bg-sand/35 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <summary className="cursor-pointer list-none text-xs font-medium text-black/50 dark:text-white/50">
        Source evidence ({snippets.length})
      </summary>
      <div className="mt-3 grid gap-2">
        {snippets.map((snippet, index) => (
          <div
            key={index}
            className="whitespace-pre-wrap text-sm text-black/70 dark:text-white/70"
          >
            {stripHtmlTags(snippet) || "Excerpt unavailable."}
          </div>
        ))}
      </div>
    </details>
  );
}
