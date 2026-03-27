import WorkspaceDealDetailPage from "@/app/app/deals/[dealId]/page";

export default function PartnershipWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ dealId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  return <WorkspaceDealDetailPage params={params} searchParams={searchParams} />;
}
