"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Filter, MoreHorizontal, Plus, Search } from "lucide-react";

import { deleteWorkspaceAction } from "@/app/actions";
import { AppTooltip } from "@/components/app-tooltip";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type HistoryStageFilter = "all" | "active" | "under_review" | "completed" | "archived";

export interface DealHistoryRow {
  id: string;
  brandName: string;
  campaignName: string;
  amount: number | null;
  currency: string;
  stageLabel: string;
  stageGroup: Exclude<HistoryStageFilter, "all">;
  date: string | null;
  deliverablesLabel: string;
  riskCount: number;
}

function ValueTooltip({
  children,
  content
}: {
  children: React.ReactNode;
  content: string;
}) {
  return (
    <AppTooltip content={content}>
      <span className="inline-flex max-w-full cursor-help items-center">{children}</span>
    </AppTooltip>
  );
}

function DealHistoryRowActions({
  dealId,
  dealName
}: {
  dealId: string;
  dealName: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center text-black/45 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            aria-label={`Open actions for ${dealName}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40 border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#161a1f]"
        >
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setDialogOpen(true);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-md border-black/10 bg-background p-6 dark:border-white/10">
          <AlertDialogHeader className="gap-3">
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              This deletes <span className="font-medium text-foreground">{dealName}</span>,
              all uploaded documents, extracted data, summaries, and related workspace
              history. This action cannot be undone or recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={deleteWorkspaceAction}>
              <input type="hidden" name="dealId" value={dealId} />
              <input type="hidden" name="redirectTo" value="/app/deals/history" />
              <AlertDialogAction asChild>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-white transition hover:bg-destructive/90"
                  onClick={() => setDialogOpen(false)}
                >
                  Delete
                </button>
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function stageDotClass(stageGroup: DealHistoryRow["stageGroup"]) {
  switch (stageGroup) {
    case "active":
      return "bg-[#7CB08B]";
    case "under_review":
      return "bg-[#E67E53]";
    case "completed":
      return "bg-[#6B7280]";
    case "archived":
      return "bg-[#CBD5E1]";
    default:
      return "bg-[#CBD5E1]";
  }
}

function exportRows(rows: DealHistoryRow[]) {
  const header = [
    "Brand",
    "Campaign",
    "Amount",
    "Currency",
    "Stage",
    "Date",
    "Deliverables",
    "Risk Count"
  ];
  const lines = rows.map((row) => [
    row.brandName,
    row.campaignName,
    row.amount ?? "",
    row.currency,
    row.stageLabel,
    row.date ?? "",
    row.deliverablesLabel,
    row.riskCount
  ]);
  const csv = [header, ...lines]
    .map((line) =>
      line
        .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hellobrand-deals.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function DealHistoryTable({
  rows,
  metrics
}: {
  rows: DealHistoryRow[];
  metrics: {
    totalDeals: number;
    activeDeals: number;
    totalEarned: number;
    averageDealSize: number;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<HistoryStageFilter>("all");
  const [includeRisksOnly, setIncludeRisksOnly] = useState(false);
  const [hasDeliverablesOnly, setHasDeliverablesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        row.brandName.toLowerCase().includes(normalizedQuery) ||
        row.campaignName.toLowerCase().includes(normalizedQuery);
      const matchesStage =
        stageFilter === "all" || row.stageGroup === stageFilter;
      const matchesRisks = !includeRisksOnly || row.riskCount > 0;
      const matchesDeliverables =
        !hasDeliverablesOnly || row.deliverablesLabel !== "Not started";

      return matchesQuery && matchesStage && matchesRisks && matchesDeliverables;
    });
  }, [hasDeliverablesOnly, includeRisksOnly, query, rows, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stageCounts = useMemo(() => {
    return {
      all: rows.length,
      active: rows.filter((row) => row.stageGroup === "active").length,
      under_review: rows.filter((row) => row.stageGroup === "under_review").length,
      completed: rows.filter((row) => row.stageGroup === "completed").length,
      archived: rows.filter((row) => row.stageGroup === "archived").length
    };
  }, [rows]);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-[46px] font-semibold tracking-[-0.06em] text-foreground">
            All Deals
          </h1>
          <p className="text-lg text-muted-foreground">
            View and manage all your brand partnerships
          </p>
        </div>
        <Link
          href="/app/intake/new"
          className={cn(buttonVariants({ className: "gap-2 rounded-full px-5" }))}
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </Link>
      </section>

      <section className="grid gap-px overflow-hidden border border-black/8 bg-black/8 md:grid-cols-4 dark:border-white/10 dark:bg-white/10">
        <div className="bg-white px-6 py-5 dark:bg-[#161a1f]">
          <p className="text-sm text-muted-foreground">Total Deals</p>
          <p className="mt-1 text-[18px] font-semibold text-foreground">{metrics.totalDeals}</p>
        </div>
        <div className="bg-white px-6 py-5 dark:bg-[#161a1f]">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="mt-1 text-[18px] font-semibold text-foreground">{metrics.activeDeals}</p>
        </div>
        <div className="bg-white px-6 py-5 dark:bg-[#161a1f]">
          <p className="text-sm text-muted-foreground">Total Earned</p>
          <p className="mt-1 text-[18px] font-semibold text-foreground">
            {formatCurrency(metrics.totalEarned)}
          </p>
        </div>
        <div className="bg-white px-6 py-5 dark:bg-[#161a1f]">
          <p className="text-sm text-muted-foreground">Avg Deal Size</p>
          <p className="mt-1 text-[18px] font-semibold text-foreground">
            {formatCurrency(metrics.averageDealSize)}
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setPage(1);
              }}
              placeholder="Search deals by brand or campaign..."
              className="h-12 w-full border border-black/10 bg-white pl-11 pr-4 text-[15px] text-foreground outline-none placeholder:text-[#7d8898] dark:border-white/10 dark:bg-[#161a1f]"
            />
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-full px-4">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#161a1f]"
              >
                <DropdownMenuLabel>Refine results</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={includeRisksOnly}
                  onCheckedChange={(checked) => {
                    setIncludeRisksOnly(Boolean(checked));
                    setPage(1);
                  }}
                >
                  Only deals with risks
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={hasDeliverablesOnly}
                  onCheckedChange={(checked) => {
                    setHasDeliverablesOnly(Boolean(checked));
                    setPage(1);
                  }}
                >
                  Only deals with deliverables
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-full px-4"
              onClick={() => exportRows(filteredRows)}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-black/8 pb-3 dark:border-white/10">
          {[
            { key: "all", label: "All Deals" },
            { key: "active", label: "Active" },
            { key: "under_review", label: "Under Review" },
            { key: "completed", label: "Completed" },
            { key: "archived", label: "Archived" }
          ].map((tab) => {
            const isActive = stageFilter === tab.key;
            const count = stageCounts[tab.key as keyof typeof stageCounts];

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStageFilter(tab.key as HistoryStageFilter);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{tab.label}</span>
                <span className="text-xs text-[#98a2b3]">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden border border-black/8 bg-white dark:border-white/10 dark:bg-[#161a1f]">
          <Table>
            <TableHeader>
              <TableRow className="border-black/8 bg-secondary/40 hover:bg-secondary/40 dark:border-white/10 dark:bg-white/[0.03]">
                <TableHead className="px-6 py-4 text-sm font-medium text-muted-foreground">Brand</TableHead>
                <TableHead className="px-6 py-4 text-sm font-medium text-muted-foreground">Campaign</TableHead>
                <TableHead className="px-6 py-4 text-sm font-medium text-muted-foreground">Amount</TableHead>
                <TableHead className="px-6 py-4 text-sm font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="px-6 py-4 text-sm font-medium text-muted-foreground">Date</TableHead>
                <TableHead className="px-6 py-4 text-sm font-medium text-muted-foreground">Deliverables</TableHead>
                <TableHead className="px-6 py-4 text-sm font-medium text-muted-foreground">Risks</TableHead>
                <TableHead className="px-6 py-4 text-right text-sm font-medium text-muted-foreground" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No deals match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer border-black/8 hover:bg-secondary/20 dark:border-white/10 dark:hover:bg-white/[0.03]"
                    onClick={() => router.push(`/app/deals/${row.id}`)}
                  >
                    <TableCell className="px-6 py-5 text-sm font-medium text-foreground">
                      <ValueTooltip content="Brand associated with this deal.">
                        <span>{row.brandName}</span>
                      </ValueTooltip>
                    </TableCell>
                    <TableCell className="px-6 py-5 text-sm text-muted-foreground">
                      <ValueTooltip content="Campaign or workspace title for this deal.">
                        <span>{row.campaignName}</span>
                      </ValueTooltip>
                    </TableCell>
                    <TableCell className="px-6 py-5 text-sm font-medium text-foreground">
                      <ValueTooltip content="Primary payment amount currently tracked.">
                        <span>{formatCurrency(row.amount, row.currency)}</span>
                      </ValueTooltip>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <ValueTooltip content="Current stage of the deal workflow.">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", stageDotClass(row.stageGroup))} />
                          <span className="text-sm text-foreground">{row.stageLabel}</span>
                        </div>
                      </ValueTooltip>
                    </TableCell>
                    <TableCell className="px-6 py-5 text-sm text-muted-foreground">
                      <ValueTooltip content="Most relevant tracked date for this deal.">
                        <span>{formatDate(row.date)}</span>
                      </ValueTooltip>
                    </TableCell>
                    <TableCell className="px-6 py-5 text-sm text-muted-foreground">
                      <ValueTooltip content="Current deliverable progress summary.">
                        <span>{row.deliverablesLabel}</span>
                      </ValueTooltip>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      {row.riskCount > 0 ? (
                        <ValueTooltip content="Open risk flags that still need review.">
                          <span className="inline-flex border border-[#f2c6b8] px-2 py-1 text-xs text-[#d76742]">
                            {row.riskCount} flag{row.riskCount === 1 ? "" : "s"}
                          </span>
                        </ValueTooltip>
                      ) : (
                        <ValueTooltip content="No active risk flags are currently tracked.">
                          <span className="text-sm text-muted-foreground">—</span>
                        </ValueTooltip>
                      )}
                    </TableCell>
                    <TableCell
                      className="px-6 py-5 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/app/deals/${row.id}`}
                          className="text-sm font-medium text-foreground transition hover:text-primary"
                          onClick={(event) => event.stopPropagation()}
                        >
                          View
                        </Link>
                        <DealHistoryRowActions
                          dealId={row.id}
                          dealName={row.campaignName}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {filteredRows.length === 0
              ? "Showing 0 deals"
              : `Showing ${(safePage - 1) * pageSize + 1}-${Math.min(
                  safePage * pageSize,
                  filteredRows.length
                )} of ${filteredRows.length} deals`}
          </p>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-3"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .slice(0, 5)
              .map((pageNumber) => (
                <Button
                  key={pageNumber}
                  type="button"
                  variant={pageNumber === safePage ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-3"
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
