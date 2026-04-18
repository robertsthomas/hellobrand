// fallow-ignore-file unused-file
/**
 * One-off script to test isLikelyBrandDealEmail against all threads in the DB.
 *
 * Usage: npx tsx scripts/test-brand-deal-filter.ts
 */

require.extensions = require.extensions || {};
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return require.resolve("./noop-stub");
  return origResolve.call(this, request, ...args);
};

async function main() {
  const { prisma } = await import("../lib/prisma");

  const rows = await prisma.emailThread.findMany({
    include: {
      account: { select: { id: true, provider: true, emailAddress: true } },
      dealLinks: {
        include: {
          deal: { select: { brandName: true, campaignName: true } }
        }
      }
    },
    orderBy: { lastMessageAt: "desc" },
    take: 500
  });

  console.log(`Total threads: ${rows.length}\n`);

  const { isLikelyBrandDealEmail } = await import("../lib/email/smart-inbox");

  type Row = (typeof rows)[number];
  type LinkView = { dealId: string; deal: { brandName: string; campaignName: string } };

  const toListItem = (row: Row) => ({
    thread: {
      id: row.id,
      accountId: row.accountId,
      provider: row.account.provider,
      providerThreadId: row.providerThreadId,
      subject: row.subject,
      snippet: row.snippet,
      participants: (row.participantsJson as Array<{ name: string | null; email: string }>) ?? [],
      lastMessageAt: row.lastMessageAt.toISOString(),
      messageCount: row.messageCount,
      isContractRelated: row.isContractRelated,
      aiSummary: row.aiSummary,
      aiSummaryUpdatedAt: row.aiSummaryUpdatedAt?.toISOString() ?? null,
      workflowState: row.workflowState as string,
      draftUpdatedAt: row.draftUpdatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    },
    account: {
      id: row.account.id,
      provider: row.account.provider,
      emailAddress: row.account.emailAddress
    },
    links: (row.dealLinks as Array<LinkView>).map((l) => ({
      id: l.dealId,
      dealId: l.dealId,
      threadId: row.id,
      dealName: l.deal.campaignName ?? l.deal.brandName,
      brandName: l.deal.brandName,
      campaignName: l.deal.campaignName,
      linkSource: "manual",
      role: "primary" as const,
      confidence: null,
      createdAt: new Date().toISOString()
    })),
    primaryLink: null,
    referenceLinks: [],
    importantEventCount: 0,
    latestImportantEventAt: null,
    pendingTermSuggestionCount: 0,
    pendingActionItemCount: 0,
    latestPendingActionItemAt: null,
    savedDraft: null,
    noteCount: 0
  });

  let brandDealCount = 0;
  let filteredOutCount = 0;

  const filteredOut: Array<{ subject: string; snippet: string | null; reason: string }> = [];
  const kept: Array<{ subject: string; snippet: string | null; reason: string }> = [];

  for (const row of rows) {
    const item = toListItem(row);
    const isBrandDeal = isLikelyBrandDealEmail(item as any);

    if (isBrandDeal) {
      brandDealCount++;
      const reasons: string[] = [];
      if (item.thread.isContractRelated) reasons.push("isContractRelated");
      if (item.links.length > 0) reasons.push("hasLinks");
      if (item.thread.subject) reasons.push("subject");
      if (item.thread.snippet) reasons.push("snippet/body");
      kept.push({
        subject: item.thread.subject.slice(0, 80),
        snippet: item.thread.snippet?.slice(0, 80) ?? null,
        reason: reasons.join(", ")
      });
    } else {
      filteredOutCount++;
      filteredOut.push({
        subject: item.thread.subject.slice(0, 80),
        snippet: item.thread.snippet?.slice(0, 80) ?? null,
        reason: "no match"
      });
    }
  }

  console.log(`=== RESULTS ===`);
  console.log(`Brand/Agency deal emails (shown): ${brandDealCount}`);
  console.log(`Filtered out (hidden):            ${filteredOutCount}`);
  console.log();

  console.log(`=== KEPT (Brand/Agency) ===`);
  for (const entry of kept.slice(0, 50)) {
    console.log(`  [${entry.reason}] ${entry.subject}`);
    if (entry.snippet) console.log(`    > ${entry.snippet}`);
  }
  if (kept.length > 50) console.log(`  ... and ${kept.length - 50} more`);

  console.log(`\n=== FILTERED OUT (Not brand/agency) ===`);
  for (const entry of filteredOut.slice(0, 50)) {
    console.log(`  ${entry.subject}`);
    if (entry.snippet) console.log(`    > ${entry.snippet}`);
  }
  if (filteredOut.length > 50) console.log(`  ... and ${filteredOut.length - 50} more`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
