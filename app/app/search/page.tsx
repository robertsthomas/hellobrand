import { Suspense } from "react";

import { SearchResults } from "@/components/search-results";
import { requireViewer } from "@/lib/auth";
import { searchForViewer } from "@/lib/search";

export default function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="h-14 w-full animate-pulse rounded bg-black/[0.04] dark:bg-white/[0.04]" />
            <div className="h-5 w-48 animate-pulse rounded bg-black/[0.04] dark:bg-white/[0.04]" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 w-full animate-pulse rounded bg-black/[0.04] dark:bg-white/[0.04]" />
            ))}
          </div>
        </div>
      }
    >
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchContent({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const viewer = await requireViewer();
  const results = query ? await searchForViewer(viewer, query) : [];

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <SearchResults results={results} query={query} />
      </div>
    </div>
  );
}
