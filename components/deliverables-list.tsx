import { AssistantTriggerButton } from "@/components/assistant-trigger-button";
import { ProseText } from "@/components/prose-text";
import type { DeliverableItem } from "@/lib/types";
import { formatDate, humanizeToken } from "@/lib/utils";

export function DeliverablesList({
  deliverables,
  dealId,
}: {
  deliverables: DeliverableItem[];
  dealId?: string;
}) {
  const deliverableNames = deliverables
    .slice(0, 4)
    .map((item) => item.title)
    .join(", ");

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
              then confirm them in the key terms editor.
            </p>
          </div>
          {dealId ? (
            <AssistantTriggerButton
              label="Clarify deliverables"
              trigger={{
                kind: "deliverable",
                sourceId: dealId,
                label: "Clarify deliverables",
                prompt:
                  "Draft a concise creator-professional email asking the brand to confirm the deliverables, timeline, and approval flow for this partnership because the workspace does not show a reliable deliverables list yet.",
              }}
            />
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
            Creator obligations extracted from the partnership documents. Edit them in Key Terms if
            anything looks off.
          </p>
        </div>
        {dealId ? (
          <div className="flex flex-wrap items-center gap-2">
            <AssistantTriggerButton
              label="Confirm deliverables"
              trigger={{
                kind: "deliverable",
                sourceId: dealId,
                label: "Confirm deliverables",
                prompt: `Draft a concise creator-professional email confirming the current deliverables for this partnership. Use these deliverables as the starting point: ${deliverableNames || "the saved workspace deliverables"}. Ask the brand to correct anything that is off.`,
              }}
            />
            <AssistantTriggerButton
              label="Clarify timeline"
              trigger={{
                kind: "deliverable",
                sourceId: dealId,
                label: "Clarify timeline",
                prompt:
                  "Draft a concise creator-professional email clarifying the production timeline, approval window, and posting deadlines for the current deliverables in this partnership.",
              }}
            />
          </div>
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
