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
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <section className="rounded-[28px] border border-black/8 bg-white px-7 py-7 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
            Deals
          </p>
          <h1 className="mt-3 text-[46px] font-semibold tracking-[-0.06em] text-foreground">
            All workspaces
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            Your full history of creator-brand workspaces, from contracts still
            under review to finished campaigns and completed payments.
          </p>
        </section>

        <form className="grid gap-4 rounded-[28px] border border-black/8 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:grid-cols-[1fr_240px_auto]">
          <input
            className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm text-foreground"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search brand or campaign"
          />
          <select
            className="rounded-2xl border border-black/8 bg-[#f7f8fa] px-4 py-3 text-sm text-foreground"
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
          <button className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white">
            Filter
          </button>
        </form>

        <DealList deals={filteredDeals} />
      </div>
    </div>
  );
}
