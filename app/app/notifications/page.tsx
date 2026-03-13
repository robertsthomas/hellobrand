import { requireViewer } from "@/lib/auth";
import { listDealsForViewer } from "@/lib/deals";
import { getRepository } from "@/lib/repository";
import { formatDate, humanizeToken } from "@/lib/utils";

export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const deals = await listDealsForViewer(viewer);
  const aggregates = await Promise.all(
    deals.map((deal) => getRepository().getDealAggregate(viewer.id, deal.id))
  );

  const notifications = aggregates
    .filter(Boolean)
    .flatMap((aggregate) => {
      if (!aggregate) {
        return [];
      }

      const items: Array<{ id: string; message: string }> = [];
      const failedDocument = aggregate.documents.find(
        (document) => document.processingStatus === "failed"
      );
      if (failedDocument) {
        items.push({
          id: `failed-${failedDocument.id}`,
          message: `${failedDocument.fileName} failed processing in ${aggregate.deal.campaignName}.`
        });
      }

      if (aggregate.deal.paymentStatus === "late") {
        items.push({
          id: `late-${aggregate.deal.id}`,
          message: `${aggregate.deal.campaignName} is marked late for payment follow-up.`
        });
      }

      const nextDeliverable = aggregate.terms?.deliverables.find(
        (item) => item.dueDate
      );
      if (nextDeliverable) {
        items.push({
          id: `due-${nextDeliverable.id}`,
          message: `${nextDeliverable.title} for ${aggregate.deal.campaignName} is due ${formatDate(nextDeliverable.dueDate)}.`
        });
      }

      items.push({
        id: `status-${aggregate.deal.id}`,
        message: `${aggregate.deal.campaignName} is currently ${humanizeToken(aggregate.deal.status)}.`
      });

      return items;
    })
    .slice(0, 8);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Notifications</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Keep up with document failures, deliverable reminders, and payment
            follow-up prompts across your creator workspaces.
          </p>
        </section>
        <section className="max-w-4xl space-y-3">
          {notifications.map((message) => (
            <div
              key={message.id}
              className="rounded-[1.25rem] border border-black/5 dark:border-white/10 bg-sand/60 dark:bg-white/[0.06] px-4 py-4 text-sm text-black/65 dark:text-white/70"
            >
              {message.message}
            </div>
          ))}
          {notifications.length === 0 ? (
            <div className="rounded-[1.25rem] border border-black/5 dark:border-white/10 bg-sand/60 dark:bg-white/[0.06] px-4 py-4 text-sm text-black/65 dark:text-white/70">
              You’re all caught up. New document issues, due dates, and payment
              nudges will show up here.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
