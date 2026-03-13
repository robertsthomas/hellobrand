import { requireViewer } from "@/lib/auth";
import { listDealsForViewer } from "@/lib/deals";
import { getRepository } from "@/lib/repository";
import { formatCurrency } from "@/lib/utils";

export default async function AnalyticsPage() {
  const viewer = await requireViewer();
  const deals = await listDealsForViewer(viewer);
  const aggregates = await Promise.all(
    deals.map((deal) => getRepository().getDealAggregate(viewer.id, deal.id))
  );

  const safeAggregates = aggregates.filter(Boolean);
  const totalRevenue = safeAggregates.reduce(
    (sum, aggregate) => sum + (aggregate?.terms?.paymentAmount ?? 0),
    0
  );
  const awaitingPayment = safeAggregates.filter(
    (aggregate) =>
      aggregate?.deal.paymentStatus === "invoiced" ||
      aggregate?.deal.paymentStatus === "awaiting_payment" ||
      aggregate?.deal.paymentStatus === "late"
  ).length;
  const averageNetTerms = Math.round(
    safeAggregates.reduce(
      (sum, aggregate) => sum + (aggregate?.terms?.netTermsDays ?? 0),
      0
    ) / Math.max(safeAggregates.filter((aggregate) => aggregate?.terms?.netTermsDays).length, 1)
  );
  const rightsHeavyDeals = safeAggregates.filter(
    (aggregate) =>
      aggregate?.riskFlags.some((flag) => flag.category === "usage_rights") ?? false
  ).length;

  const cards = [
    { label: "Tracked revenue", value: formatCurrency(totalRevenue) },
    { label: "Awaiting payment", value: String(awaitingPayment) },
    {
      label: "Average payment term",
      value: Number.isFinite(averageNetTerms) ? `${averageNetTerms} days` : "Not set"
    },
    { label: "Rights-heavy deals", value: String(rightsHeavyDeals) }
  ];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <h1 className="text-4xl font-semibold text-ink">Analytics</h1>
          <p className="mt-4 max-w-3xl text-black/60 dark:text-white/65">
            A lightweight creator overview of revenue, payment timing, and how
            often your deals include usage-rights watchouts.
          </p>
        </section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-[1.5rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-5 shadow-panel"
            >
              <div className="text-sm text-black/45 dark:text-white/45">{card.label}</div>
              <div className="mt-4 text-3xl font-semibold text-ink">{card.value}</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
