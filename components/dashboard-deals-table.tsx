"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";

import { DeleteDealDialog } from "@/components/delete-deal-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDisplayDealLabels } from "@/lib/deal-labels";
import { formatCurrency, formatDate, humanizeToken } from "@/lib/utils";

type DashboardDealsTableRow = {
  id: string;
  campaignName: string;
  brandName: string;
  status: string;
  paymentStatus: string;
  paymentAmount: number | null;
  currency: string;
  nextDeliverableDate: string | null;
};

function statusBadgeClass(status: string) {
  if (status === "completed" || status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/10";
  }

  if (status === "contract_received" || status === "negotiating") {
    return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/10";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] hover:bg-[#f5f6f8] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a3acb9] dark:hover:bg-white/[0.04]";
}

function paymentBadgeClass(status: string) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "late") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
  }

  if (status === "awaiting_payment" || status === "invoiced") {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300";
  }

  return "border-black/8 bg-[#f5f6f8] text-[#667085] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a3acb9]";
}

function sortStateForValue(value: string): SortingState {
  switch (value) {
    case "campaign-desc":
      return [{ id: "campaignName", desc: true }];
    case "amount-desc":
      return [{ id: "paymentAmount", desc: true }];
    case "amount-asc":
      return [{ id: "paymentAmount", desc: false }];
    case "next-due":
      return [{ id: "nextDeliverableDate", desc: false }];
    case "stage":
      return [{ id: "status", desc: false }];
    case "campaign-asc":
    default:
      return [{ id: "campaignName", desc: false }];
  }
}

function sortValueForState(sorting: SortingState): string {
  const current = sorting[0];

  if (!current) {
    return "campaign-asc";
  }

  if (current.id === "campaignName") {
    return current.desc ? "campaign-desc" : "campaign-asc";
  }

  if (current.id === "paymentAmount") {
    return current.desc ? "amount-desc" : "amount-asc";
  }

  if (current.id === "nextDeliverableDate") {
    return "next-due";
  }

  if (current.id === "status") {
    return "stage";
  }

  return "campaign-asc";
}

export function DashboardDealsTable({
  deals,
}: {
  deals: DashboardDealsTableRow[];
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>(sortStateForValue("campaign-asc"));
  const displayDeals = useMemo(
    () =>
      deals.map((deal) => {
        const labels = getDisplayDealLabels(deal);
        return {
          ...deal,
          brandName: labels.brandName ?? deal.brandName,
          campaignName: labels.campaignName ?? deal.campaignName,
        };
      }),
    [deals],
  );

  const columns = useMemo<ColumnDef<DashboardDealsTableRow>[]>(
    () => [
      {
        accessorKey: "campaignName",
        header: "Campaign",
        cell: ({ row }) => (
          <Link
            href={`/app/p/${row.original.id}`}
            className="font-semibold text-foreground transition-colors hover:text-primary"
          >
            {row.original.campaignName}
          </Link>
        ),
      },
      {
        accessorKey: "brandName",
        header: "Brand",
        cell: ({ row }) => (
          <span className="text-[15px] text-muted-foreground">{row.original.brandName}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Stage",
        sortingFn: (left, right) =>
          humanizeToken(String(left.getValue("status"))).localeCompare(
            humanizeToken(String(right.getValue("status"))),
          ),
        filterFn: (row, id, value) => !value || value === "all" || row.getValue(id) === value,
        cell: ({ row }) => (
          <Badge className={statusBadgeClass(row.original.status)}>
            {humanizeToken(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "paymentStatus",
        header: "Payment",
        filterFn: (row, id, value) => !value || value === "all" || row.getValue(id) === value,
        cell: ({ row }) => (
          <Badge className={paymentBadgeClass(row.original.paymentStatus)}>
            {humanizeToken(row.original.paymentStatus)}
          </Badge>
        ),
      },
      {
        accessorKey: "paymentAmount",
        header: "Amount",
        sortingFn: "basic",
        cell: ({ row }) => (
          <span className="text-[15px] font-medium text-foreground">
            {formatCurrency(row.original.paymentAmount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "nextDeliverableDate",
        header: "Next due",
        sortingFn: (left, right) => {
          const a = String(left.getValue("nextDeliverableDate") ?? "");
          const b = String(right.getValue("nextDeliverableDate") ?? "");

          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b);
        },
        cell: ({ row }) => (
          <span className="text-[15px] text-muted-foreground">
            {formatDate(row.original.nextDeliverableDate)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center text-black/45 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
                  aria-label={`Open actions for ${row.original.campaignName}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#161a1f]"
              >
                <DeleteDealDialog
                  dealId={row.original.id}
                  dealName={row.original.campaignName}
                  redirectTo="/app"
                  triggerMode="menu-item"
                  menuLabel="Delete partnership"
                >
                  Delete partnership
                </DeleteDealDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: displayDeals,
    columns,
    state: {
      globalFilter,
      columnFilters,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue) => {
      const normalizedFilter = String(filterValue ?? "").trim().toLowerCase();

      if (!normalizedFilter) {
        return true;
      }

      return (
        row.original.campaignName.toLowerCase().includes(normalizedFilter) ||
        row.original.brandName.toLowerCase().includes(normalizedFilter)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowCount = table.getFilteredRowModel().rows.length;
  const sortValue = sortValueForState(sorting);

  return (
    <section className="space-y-0">
      <div className="border-b border-black/8 pb-8 dark:border-white/10">
        <p className="text-xs uppercase tracking-[0.16em] text-[#98a2b3] dark:text-[#8f98a6]">
          Partnerships
        </p>
        <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-foreground">
          All partnerships
        </h2>
      </div>

      <div className="border-b border-black/8 py-5 dark:border-white/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3] dark:text-[#8f98a6]" />
            <input
              type="search"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search brand or campaign"
              className="h-11 w-full border-0 bg-transparent pl-8 pr-2 text-[15px] text-foreground outline-none placeholder:text-[#7d8898] dark:placeholder:text-[#8f98a6]"
            />
          </div>

          <div className="grid w-full grid-cols-2 gap-3 text-sm sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <select
              value={String(table.getColumn("status")?.getFilterValue() ?? "all")}
              onChange={(event) =>
                table
                  .getColumn("status")
                  ?.setFilterValue(event.target.value === "all" ? undefined : event.target.value)
              }
              className="h-12 w-full rounded-none border border-black/30 bg-white px-4 text-[15px] text-foreground outline-none sm:w-auto sm:min-w-[170px] dark:border-white/15 dark:bg-[#161a1f]"
            >
              <option value="all">All stages</option>
              <option value="contract_received">Contract received</option>
              <option value="negotiating">Negotiating</option>
              <option value="completed">Completed</option>
              <option value="paid">Paid</option>
            </select>

            <select
              value={String(table.getColumn("paymentStatus")?.getFilterValue() ?? "all")}
              onChange={(event) =>
                table
                  .getColumn("paymentStatus")
                  ?.setFilterValue(
                    event.target.value === "all" ? undefined : event.target.value,
                  )
              }
              className="h-12 w-full rounded-none border border-black/30 bg-white px-4 text-[15px] text-foreground outline-none sm:w-auto sm:min-w-[170px] dark:border-white/15 dark:bg-[#161a1f]"
            >
              <option value="all">All payments</option>
              <option value="draft">Draft</option>
              <option value="invoiced">Invoiced</option>
              <option value="awaiting_payment">Awaiting payment</option>
              <option value="late">Late</option>
              <option value="paid">Paid</option>
            </select>

            <select
              value={sortValue}
              onChange={(event) => setSorting(sortStateForValue(event.target.value))}
              className="col-span-2 h-12 w-full rounded-none border border-black/30 bg-white px-4 text-[15px] text-foreground outline-none sm:w-auto sm:min-w-[160px] dark:border-white/15 dark:bg-[#161a1f]"
            >
              <option value="campaign-asc">Campaign A-Z</option>
              <option value="campaign-desc">Campaign Z-A</option>
              <option value="amount-desc">Amount high-low</option>
              <option value="amount-asc">Amount low-high</option>
              <option value="next-due">Next due</option>
              <option value="stage">Stage</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 py-4 md:hidden">
        {table.getRowModel().rows.map((row) => (
          <Link
            key={row.id}
            href={`/app/p/${row.original.id}`}
            className="block border border-black/8 bg-white p-4 transition-colors hover:bg-[#f6f7f8] dark:border-white/10 dark:bg-[#161a1f] dark:hover:bg-white/[0.03]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-foreground">
                  {row.original.campaignName}
                </p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {row.original.brandName}
                </p>
              </div>
              <div className="shrink-0" onClick={(event) => event.preventDefault()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center text-black/45 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
                      aria-label={`Open actions for ${row.original.campaignName}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-44 border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#161a1f]"
                  >
                    <DeleteDealDialog
                      dealId={row.original.id}
                      dealName={row.original.campaignName}
                      redirectTo="/app"
                      triggerMode="menu-item"
                      menuLabel="Delete partnership"
                    >
                      Delete partnership
                    </DeleteDealDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#98a2b3] dark:text-[#8f98a6]">Stage</p>
                <div className="mt-1">
                  <Badge className={statusBadgeClass(row.original.status)}>
                    {humanizeToken(row.original.status)}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#98a2b3] dark:text-[#8f98a6]">Payment</p>
                <div className="mt-1">
                  <Badge className={paymentBadgeClass(row.original.paymentStatus)}>
                    {humanizeToken(row.original.paymentStatus)}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#98a2b3] dark:text-[#8f98a6]">Amount</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatCurrency(row.original.paymentAmount, row.original.currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#98a2b3] dark:text-[#8f98a6]">Next due</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(row.original.nextDeliverableDate)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="px-0 py-5 text-[11px] uppercase tracking-[0.22em] text-[#98a2b3] dark:text-[#8f98a6]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-[#f6f7f8] dark:hover:bg-white/[0.03]">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      cell.column.id === "actions" ? "px-0 py-7 text-right" : "px-0 py-7"
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="py-5 text-sm text-muted-foreground">
        Showing {rowCount} of {deals.length} partnerships
      </div>
    </section>
  );
}
