"use client";

import { ChevronDown, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type BlogSearchInputProps = {
  initialQuery: string;
  initialSort: string;
  selectedTag: string | null;
};

export function BlogSearchInput({ initialQuery, initialSort, selectedTag }: BlogSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setSort(initialSort);
  }, [initialSort]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmedQuery = query.trim();

      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      } else {
        params.delete("q");
      }

      if (selectedTag) {
        params.set("tag", selectedTag);
      } else {
        params.delete("tag");
      }

      if (sort !== "newest") {
        params.set("sort", sort);
      } else {
        params.delete("sort");
      }

      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      const currentUrl = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;

      if (nextUrl === currentUrl) {
        return;
      }

      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams, selectedTag, sort]);

  return (
    <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
      <div className="flex items-center gap-3 border border-[#e6dfd1] bg-[#fcfaf6] px-4 py-3 focus-within:border-[#7d8898] focus-within:ring-2 focus-within:ring-ring/30 dark:border-[#22272d] dark:bg-[#13161b] dark:focus-within:border-white/30">
        <Search className="h-4 w-4 shrink-0 text-[#7b7468] dark:text-[#8b94a1]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search articles"
          aria-label="Search blog articles"
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[0.95rem] text-[#111] shadow-none outline-none ring-0 [-webkit-appearance:none] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-[#8a8478] dark:text-white dark:placeholder:text-[#697281]"
        />
        {isPending ? (
          <span className="text-[11px] font-medium text-[#8a8478] dark:text-[#697281]">
            Updating
          </span>
        ) : null}
      </div>
      <div className="border border-[#e6dfd1] bg-[#fcfaf6] px-4 py-3 dark:border-[#22272d] dark:bg-[#13161b]">
        <label className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[#8a8478] dark:text-[#697281]">
          <span>Sort</span>
          <span className="relative min-w-0 flex-1">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort blog articles"
              className="min-w-0 w-full appearance-none border-0 bg-transparent p-0 pr-6 text-right text-[0.95rem] font-medium normal-case tracking-normal text-[#111] outline-none ring-0 focus:outline-none focus:ring-0 dark:text-white"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">A to Z</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8478] dark:text-[#697281]" />
          </span>
        </label>
      </div>
    </div>
  );
}
