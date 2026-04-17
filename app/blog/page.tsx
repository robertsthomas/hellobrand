import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BlogSearchInput } from "@/components/blog-search-input";
import { MarketingNav } from "@/components/marketing-nav";
import {
  getBlogIndexOgImageUrl,
  getBlogPosts,
  getFeaturedBlogPost
} from "@/lib/blog";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { formatDate } from "@/lib/utils";

const blogDescription =
  "SEO-focused creator operations guides covering contracts, usage rights, exclusivity, payments, and brand partnership workflows.";

export const metadata: Metadata = {
  title: "Blog | HelloBrand",
  description: blogDescription,
  keywords: [
    "creator contracts blog",
    "influencer agreement guide",
    "creator business tips",
    "brand deal workflow",
    "creator operations"
  ],
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: "/blog"
  },
  openGraph: {
    title: "HelloBrand Blog",
    description: blogDescription,
    url: absoluteUrl("/blog"),
    siteName: siteConfig.name,
    type: "website",
    images: [
      {
        url: getBlogIndexOgImageUrl(),
        width: 1200,
        height: 630,
        alt: "HelloBrand blog"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "HelloBrand Blog",
    description: blogDescription,
    images: [getBlogIndexOgImageUrl()]
  }
};

type BlogIndexPageProps = {
  searchParams?: Promise<{ tag?: string; q?: string; sort?: string }>;
};

type BlogSortValue = "newest" | "oldest" | "title";

function sortTagsByUsage(posts: ReturnType<typeof getBlogPosts>) {
  const usage = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.tags) {
      usage.set(tag, (usage.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(usage.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag]) => tag);
}

function buildVisibleTags(allTags: string[], selectedTag: string | null) {
  const baseTags = allTags.slice(0, 6);

  if (selectedTag && !baseTags.includes(selectedTag)) {
    return [...baseTags.slice(0, 5), selectedTag];
  }

  return baseTags;
}

function buildBlogIndexHref(filters: {
  tag?: string | null;
  q?: string | null;
  sort?: BlogSortValue | null;
}) {
  const params = new URLSearchParams();

  if (filters.tag?.trim()) {
    params.set("tag", filters.tag.trim());
  }

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.sort && filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }

  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}

function matchesSearch(post: ReturnType<typeof getBlogPosts>[number], query: string) {
  const haystack = [
    post.title,
    post.description,
    post.category,
    ...post.tags,
    ...post.keywords
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function resolveBlogSortValue(sort: string | undefined): BlogSortValue {
  if (sort === "oldest" || sort === "title") {
    return sort;
  }

  return "newest";
}

function sortBlogPosts(
  posts: ReturnType<typeof getBlogPosts>,
  sort: BlogSortValue
) {
  const nextPosts = [...posts];

  if (sort === "oldest") {
    return nextPosts.sort(
      (left, right) =>
        new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime()
    );
  }

  if (sort === "title") {
    return nextPosts.sort((left, right) => left.title.localeCompare(right.title));
  }

  return nextPosts;
}

// fallow-ignore-next-line complexity
export default async function BlogIndexPage({
  searchParams
}: BlogIndexPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const posts = getBlogPosts();
  const allTags = sortTagsByUsage(posts);
  const searchQuery = resolvedSearchParams?.q?.trim() || "";
  const selectedSort = resolveBlogSortValue(resolvedSearchParams?.sort);
  const selectedTag =
    allTags.find(
      (tag) =>
        tag.toLowerCase() === resolvedSearchParams?.tag?.trim().toLowerCase()
    ) ?? null;
  const sidebarTags = buildVisibleTags(allTags, selectedTag);
  const filteredPosts = posts.filter((post) => {
    if (selectedTag && !post.tags.includes(selectedTag)) {
      return false;
    }

    if (searchQuery && !matchesSearch(post, searchQuery)) {
      return false;
    }

    return true;
  });
  const sortedPosts = sortBlogPosts(filteredPosts, selectedSort);
  const featuredPost =
    selectedSort === "newest"
      ? sortedPosts.find((post) => post.featured) ??
        (selectedTag || searchQuery ? sortedPosts[0] ?? null : getFeaturedBlogPost())
      : sortedPosts[0] ?? null;
  const recentPosts = sortedPosts.filter((post) => post.slug !== featuredPost?.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${siteConfig.name} Blog`,
    description: blogDescription,
    url: absoluteUrl("/blog"),
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: absoluteUrl("/")
    },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      url: absoluteUrl(`/blog/${post.slug}`),
      image: [
        post.coverImageUrl.startsWith("http")
          ? post.coverImageUrl
          : absoluteUrl(post.coverImageUrl)
      ],
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      author: {
        "@type": "Organization",
        name: post.author
      }
    }))
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1115]">
      <MarketingNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-14 pb-16 pt-14 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:pt-20">
          <aside className="lg:sticky lg:top-[108px] lg:self-start">
            <div className="lg:pr-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b7468] dark:text-[#8b94a1]">
                Topics
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5 lg:max-w-[190px] lg:flex-col lg:flex-nowrap lg:gap-2">
                <Link
                  href={buildBlogIndexHref({ q: searchQuery, sort: selectedSort })}
                  className={`inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors lg:w-full ${
                    selectedTag === null
                      ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(44,94,78,0.08)] dark:bg-primary/15 dark:text-[#8ec6b1]"
                      : "bg-[#f7f3ea] text-[#5e5442] hover:bg-[#ece5d7] dark:bg-[#15191e] dark:text-[#a3abb6] dark:hover:bg-[#1a2128]"
                  }`}
                >
                  <span>All posts</span>
                </Link>
                {sidebarTags.map((tag) => {
                  const isActive = selectedTag === tag;

                  return (
                    <Link
                      key={tag}
                      href={buildBlogIndexHref({
                        tag,
                        q: searchQuery,
                        sort: selectedSort
                      })}
                      className={`inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors lg:w-full ${
                        isActive
                          ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(44,94,78,0.08)] dark:bg-primary/15 dark:text-[#8ec6b1]"
                          : "bg-[#f7f3ea] text-[#5e5442] hover:bg-[#ece5d7] dark:bg-[#15191e] dark:text-[#a3abb6] dark:hover:bg-[#1a2128]"
                      }`}
                    >
                      <span>{tag}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            {/* Header */}
            <header className="pb-10">
              <h1 className="text-[2rem] font-bold tracking-tight text-[#111] sm:text-[2.5rem] dark:text-white">
                Blog
              </h1>
              <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed text-[#555] dark:text-[#999]">
                Practical guides on creator contracts, inbox workflows, payment
                tracking, and partnership operations.
              </p>
              <BlogSearchInput
                initialQuery={searchQuery}
                initialSort={selectedSort}
                selectedTag={selectedTag}
              />
              {selectedTag || searchQuery || selectedSort !== "newest" ? (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {selectedTag ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary dark:bg-primary/15 dark:text-[#8ec6b1]">
                      <span>Tag</span>
                      <span>{selectedTag}</span>
                    </span>
                  ) : null}
                  {searchQuery ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#f5f1e8] px-3 py-1.5 text-[12px] font-semibold text-[#5e5442] dark:bg-[#15191e] dark:text-[#a3abb6]">
                      <span>Search</span>
                      <span>{searchQuery}</span>
                    </span>
                  ) : null}
                  {selectedSort !== "newest" ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#f5f1e8] px-3 py-1.5 text-[12px] font-semibold text-[#5e5442] dark:bg-[#15191e] dark:text-[#a3abb6]">
                      <span>Sort</span>
                      <span>{selectedSort === "oldest" ? "Oldest" : "A to Z"}</span>
                    </span>
                  ) : null}
                  <Link
                    href="/blog"
                    className="text-[12px] font-medium text-[#7b7468] underline underline-offset-4 dark:text-[#8b94a1]"
                  >
                    Clear filters
                  </Link>
                </div>
              ) : null}
            </header>

            {/* Featured */}
            {featuredPost ? (
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="block px-4 py-10 transition-colors hover:bg-[#fbf8f0] sm:px-5 dark:hover:bg-[#13161b]"
              >
                {featuredPost.featured ? (
                  <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary dark:bg-primary/20">
                    Featured
                  </span>
                ) : null}
                <h2 className="mt-4 text-[1.5rem] font-bold leading-snug tracking-tight text-[#111] sm:text-[1.75rem] dark:text-white">
                  {featuredPost.title}
                </h2>
                <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-[#555] dark:text-[#999]">
                  {featuredPost.description}
                </p>
                <div className="mt-4 flex items-center gap-4 text-[13px] text-[#888] dark:text-[#666]">
                  <span>{featuredPost.category}</span>
                  <span aria-hidden="true">&middot;</span>
                  <time dateTime={featuredPost.publishedAt}>
                    {formatDate(featuredPost.publishedAt)}
                  </time>
                  <span aria-hidden="true">&middot;</span>
                  <span>{featuredPost.readingTime}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {featuredPost.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#e5dfcf] bg-[#fffdf7] px-3 py-1 text-[11px] font-medium tracking-[0.01em] text-[#5e5442] dark:border-[#2a2d31] dark:bg-[#111418] dark:text-[#a3abb6]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ) : null}

            {/* Posts list */}
            {recentPosts.length > 0 ? (
              <div className="mt-10 space-y-6 sm:space-y-8">
                {recentPosts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="block px-4 py-8 transition-colors hover:bg-[#fbf8f0] sm:px-5 dark:hover:bg-[#13161b]"
                  >
                    <div className="flex items-center gap-4 text-[13px] text-[#888] dark:text-[#666]">
                      <span>{post.category}</span>
                      <span aria-hidden="true">&middot;</span>
                      <time dateTime={post.publishedAt}>
                        {formatDate(post.publishedAt)}
                      </time>
                      <span aria-hidden="true">&middot;</span>
                      <span>{post.readingTime}</span>
                    </div>
                    <h3 className="mt-3 text-[1.2rem] font-bold leading-snug tracking-tight text-[#111] sm:text-[1.35rem] dark:text-white">
                      {post.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-[#555] dark:text-[#999]">
                      {post.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[#e7e1d1] bg-[#fffdf8] px-3 py-1 text-[11px] font-medium tracking-[0.01em] text-[#5f5646] dark:border-[#2a2d31] dark:bg-[#111418] dark:text-[#9ea6b0]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary dark:text-[#8ec6b1]">
                      Read article
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <blockquote className="border-t border-[#e8e8e8] py-8 dark:border-[#222]">
                <p className="max-w-2xl text-[1rem] leading-relaxed text-[#555] dark:text-[#999]">
                  {selectedTag
                    ? `No posts found for ${selectedTag}${searchQuery ? ` matching "${searchQuery}"` : ""}.`
                    : searchQuery
                      ? `No posts found for "${searchQuery}".`
                      : "\"If a deal changes your future earning power, it should change the fee. Rights, exclusivity, and usage are never throwaway details.\""}
                </p>
              </blockquote>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
