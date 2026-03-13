import { requireViewer } from "@/lib/auth";
import { listDealsForViewer } from "@/lib/deals";
import { getRepository } from "@/lib/repository";
import { DealList } from "@/components/deal-list";
import { humanizeToken } from "@/lib/utils";

export default async function DealHistoryPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const viewer = await requireViewer();
  const deals = await listDealsForViewer(viewer);
  const params = (await searchParams) ?? {};
  const query = params.q?.toLowerCase().trim() ?? "";
  const selectedStatus = params.status?.trim() ?? "";
  const enrichedDeals = await Promise.all(
    deals.map(async (deal) => {
      const aggregate = await getRepository().getDealAggregate(viewer.id, deal.id);
      return {
        ...deal,
        paymentAmount: aggregate?.terms?.paymentAmount ?? null,
        currency: aggregate?.terms?.currency ?? "USD"
      };
    })
  );
  const filteredDeals = enrichedDeals.filter((deal) => {
    const matchesQuery =
      query.length === 0 ||
      deal.brandName.toLowerCase().includes(query) ||
      deal.campaignName.toLowerCase().includes(query);
    const matchesStatus =
      selectedStatus.length === 0 || deal.status === selectedStatus;

    return matchesQuery && matchesStatus;
  });
  const statuses = Array.from(new Set(enrichedDeals.map((deal) => deal.status)));

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <h1 className="text-4xl font-semibold text-ink">All deals</h1>
          <p className="mt-4 max-w-3xl text-black/60 dark:text-white/65">
            Your full history of creator-brand workspaces, from contracts still
            under review to finished campaigns.
          </p>
        </section>
        <form className="grid gap-4 rounded-[1.75rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 p-5 shadow-panel md:grid-cols-[1fr_220px_auto]">
          <input
            className="rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3 text-sm"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search brand or campaign"
          />
          <select
            className="rounded-[1.25rem] border border-black/10 dark:border-white/12 bg-sand/40 dark:bg-white/[0.04] px-4 py-3 text-sm"
            name="status"
            defaultValue={selectedStatus}
          >
            <option value="">All stages</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {humanizeToken(status)}
              </option>
            ))}
          </select>
          <button className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white">
            Filter
          </button>
        </form>
        <DealList deals={filteredDeals} />
      </div>
    </div>
  );
}
