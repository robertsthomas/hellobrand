import { buildAssistantHref } from "@/lib/assistant/app-manual";
import { prisma } from "@/lib/prisma";
import { getRepository } from "@/lib/repository";
import type { Viewer } from "@/lib/types";

export async function buildWorkspaceSelectionBlock(input: {
  viewer: Viewer;
  prompt: string | null;
  title: string;
  description: string;
  query?: string | null;
  tab?: string | null;
}) {
  const deals = process.env.DATABASE_URL
    ? await prisma.deal.findMany({
        where: { userId: input.viewer.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          brandName: true,
          campaignName: true,
          status: true,
          paymentStatus: true
        }
      })
    : await getRepository().listDeals(input.viewer.id);
  const filtered = input.query?.trim()
    ? deals.filter((deal) => {
        const lower = input.query!.toLowerCase();
        return (
          deal.brandName.toLowerCase().includes(lower) ||
          deal.campaignName.toLowerCase().includes(lower)
        );
      })
    : deals;

  return {
    type: "workspace-list" as const,
    title: input.title,
    description: input.description,
    prompt: input.prompt,
    workspaces: filtered.slice(0, 6).map((deal) => ({
      dealId: deal.id,
      brandName: deal.brandName,
      campaignName: deal.campaignName,
      status: deal.status,
      paymentStatus: deal.paymentStatus,
      href: buildAssistantHref(input.tab || "overview", {
        dealId: deal.id
      }) ?? `/app/p/${deal.id}`,
      prompt: input.prompt
    }))
  };
}
