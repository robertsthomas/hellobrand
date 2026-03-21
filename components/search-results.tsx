"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Calendar,
  FileText,
  Filter,
  Search,
  Shield,
  StickyNote,
  X
} from "lucide-react";

import type { SearchResultKind } from "@/lib/search";

interface SearchResultItem {
  id: string;
  kind: SearchResultKind;
  dealId: string;
  dealName: string;
  brandName: string;
  title: string;
  snippet: string;
  matchedField: string;
  score: number;
  updatedAt: string;
}

const KIND_CONFIG: Record<SearchResultKind, { label: string; icon: typeof FileText; color: string }> = {
  deal: { label: "Partnership", icon: StickyNote, color: "bg-ocean/10 text-ocean" },
  document: { label: "Document", icon: FileText, color: "bg-blue-500/10 text-blue-600" },
  terms: { label: "Terms", icon: StickyNote, color: "bg-emerald-500/10 text-emerald-600" },
  risk: { label: "Risk", icon: Shield, color: "bg-red-500/10 text-red-600" },
  section: { label: "Section", icon: FileText, color: "bg-purple-500/10 text-purple-600" },
  summary: { label: "Summary", icon: StickyNote, color: "bg-amber-500/10 text-amber-600" }
};

type SortMode = "relevance" | "date" | "name";
type FilterKind = SearchResultKind | "all";

function highlightMatch(text: string, query: string) {
  if (!query.trim() || !text) return text;

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200/60 text-foreground dark:bg-yellow-500/20">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function SearchResults({
  results,
  query
}: {
  results: SearchResultItem[];
  query: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [localQuery, setLocalQuery] = useState(query);

  const filteredResults = useMemo(() => {
    let items = filterKind === "all" ? results : results.filter((r) => r.kind === filterKind);

    if (sortMode === "date") {
      items = [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sortMode === "name") {
      items = [...items].sort((a, b) => a.dealName.localeCompare(b.dealName));
    }

    return items;
  }, [results, sortMode, filterKind]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { all: results.length };
    for (const r of results) {
      counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    }
    return counts;
  }, [results]);

  const uniquePartnerships = useMemo(() => {
    const map = new Map<string, { id: string; name: string; brand: string }>();
    for (const r of results) {
      if (!map.has(r.dealId)) {
        map.set(r.dealId, { id: r.dealId, name: r.dealName, brand: r.brandName });
      }
    }
    return map.size;
  }, [results]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = localQuery.trim();
    if (!trimmed) return;
    router.push(`/app/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="space-y-6">
      {/* Search input */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/30 dark:text-white/30" />
        <input
          type="search"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search partnerships, documents, terms, risks..."
          className="h-14 w-full border border-black/10 bg-white pl-12 pr-4 text-lg text-foreground outline-none transition placeholder:text-black/30 focus:border-black/20 dark:border-white/12 dark:bg-white/[0.03] dark:placeholder:text-white/30 dark:focus:border-white/20"
        />
      </form>

      {/* Results header */}
      {query ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 pb-4 dark:border-white/10">
          <div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{results.length}</span> result{results.length === 1 ? "" : "s"}
              {" across "}
              <span className="font-semibold text-foreground">{uniquePartnerships}</span> partnership{uniquePartnerships === 1 ? "" : "s"}
              {" for "}
              <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
            </p>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            {(["relevance", "date", "name"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${
                  sortMode === mode
                    ? "bg-foreground text-white"
                    : "border border-black/8 text-muted-foreground hover:text-foreground dark:border-white/10"
                }`}
              >
                {mode === "relevance" && <ArrowUpDown className="h-3 w-3" />}
                {mode === "date" && <Calendar className="h-3 w-3" />}
                {mode === "name" && <ArrowDownAZ className="h-3 w-3" />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Filter pills */}
      {query && results.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(["all", "deal", "document", "terms", "risk", "section", "summary"] as FilterKind[]).map((kind) => {
            const count = kindCounts[kind] ?? 0;
            if (kind !== "all" && count === 0) return null;
            const config = kind === "all" ? null : KIND_CONFIG[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setFilterKind(kind)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${
                  filterKind === kind
                    ? "bg-foreground text-white"
                    : "border border-black/8 text-muted-foreground hover:text-foreground dark:border-white/10"
                }`}
              >
                {kind === "all" ? "All" : config?.label}
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
          {filterKind !== "all" ? (
            <button
              type="button"
              onClick={() => setFilterKind("all")}
              className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Results list */}
      {query && filteredResults.length === 0 ? (
        <div className="border border-dashed border-black/10 py-20 text-center dark:border-white/10">
          <Search className="mx-auto h-8 w-8 text-black/20 dark:text-white/20" />
          <h3 className="mt-4 text-xl font-semibold text-foreground">No results found</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Try a different search term or broaden your query. Search covers partnership names, document text, terms, risks, and summaries.
          </p>
        </div>
      ) : null}

      {!query ? (
        <div className="border border-dashed border-black/10 py-20 text-center dark:border-white/10">
          <Search className="mx-auto h-8 w-8 text-black/20 dark:text-white/20" />
          <h3 className="mt-4 text-xl font-semibold text-foreground">Search your workspace</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Search across all partnerships, uploaded documents, extracted terms, risk flags, and AI-generated summaries.
          </p>
        </div>
      ) : null}

      <div className="divide-y divide-black/6 dark:divide-white/8">
        {filteredResults.map((result) => {
          const config = KIND_CONFIG[result.kind];
          const Icon = config.icon;

          return (
            <Link
              key={result.id}
              href={`/app/deals/${result.dealId}`}
              className="group block py-5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.02]"
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-foreground group-hover:text-primary">
                        {highlightMatch(result.title, query)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{result.brandName}</span>
                        <span className="text-black/20 dark:text-white/20">/</span>
                        <span>{config.label}</span>
                        <span className="text-black/20 dark:text-white/20">/</span>
                        <span>{formatDate(result.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="flex h-5 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-black/30 dark:text-white/30">
                        {Math.round(result.score)}%
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-black/55 dark:text-white/55">
                    {highlightMatch(result.snippet, query)}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
