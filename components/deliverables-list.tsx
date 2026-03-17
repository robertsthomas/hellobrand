import type { DeliverableItem } from "@/lib/types";
import { formatDate, humanizeToken } from "@/lib/utils";

export function DeliverablesList({
  deliverables
}: {
  deliverables: DeliverableItem[];
}) {
  if (deliverables.length === 0) {
    return (
      <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Deliverables
        </h2>
        <p className="mt-4 text-sm text-black/60 dark:text-white/65">
          No deliverables have been extracted yet. Upload a contract, brief, or
          email thread, then confirm them in the key terms editor.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#161a1f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Deliverables
          </h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/65">
            Creator obligations extracted from the deal documents. Edit them in
            Key Terms if anything looks off.
          </p>
        </div>
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
                <p className="mt-2 text-sm leading-6 text-black/60 dark:text-white/65">
                  {item.description}
                </p>
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
