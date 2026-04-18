import { ProseText } from "@/components/prose-text";
import { AssistantSuggestionDropdown } from "@/components/assistant-suggestion-dropdown";
import { buildDeliverableSuggestions } from "@/lib/assistant-suggestions";
import type { DeliverableItem } from "@/lib/types";
import { formatDate, humanizeToken } from "@/lib/utils";

export function DeliverablesList({
  deliverables,
  dealId,
}: {
  deliverables: DeliverableItem[];
  dealId?: string;
}) {
  const suggestions = dealId ? buildDeliverableSuggestions(dealId, deliverables) : [];

  if (deliverables.length === 0) {
    return (
      <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
              Deliverables
            </h2>
            <p className="mt-4 text-sm text-black/60 dark:text-white/65">
              No deliverables have been extracted yet. Upload a contract, brief, or email thread,
              then confirm them with the brand.
            </p>
          </div>
          {suggestions.length > 0 ? (
            <AssistantSuggestionDropdown suggestions={suggestions} />
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            Deliverables
          </h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/65">
            Creator obligations extracted from the partnership documents.
          </p>
        </div>
        {suggestions.length > 0 ? (
          <AssistantSuggestionDropdown suggestions={suggestions} />
        ) : null}
      </div>
      <div className="mt-5 grid gap-3">
        {deliverables.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 border border-black/8 p-4 dark:border-white/10 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
          >
            <div>
              <h3 className="font-semibold text-black/80 dark:text-white/85">{item.title}</h3>
              <p className="mt-1 text-sm text-black/60 dark:text-white/65">
                {item.channel ?? "Channel not specified"}
              </p>
              {item.description ? (
                <div className="mt-2 line-clamp-3 text-sm leading-6 text-black/60 dark:text-white/65">
                  <ProseText
                    content={item.description}
                    className="text-sm text-black/60 dark:text-white/65"
                  />
                </div>
              ) : null}
            </div>
            <div className="text-sm text-black/60 dark:text-white/65">
              <div className="text-black/45 dark:text-white/45">Quantity</div>
              <div>{item.quantity ?? "TBD"}</div>
            </div>
            <div className="text-sm text-black/60 dark:text-white/65">
              <div className="text-black/45 dark:text-white/45">Due date</div>
              <div>{formatDate(item.dueDate)}</div>
            </div>
            <div>
              <span className="inline-flex border border-black/8 px-3 py-1 text-xs font-semibold text-black/65 dark:border-white/10 dark:text-white/70">
                {humanizeToken(item.status ?? "pending")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
