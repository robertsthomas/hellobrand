import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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

export default function BlogIndexPage() {
  const posts = getBlogPosts();
  const featuredPost = getFeaturedBlogPost();
  const recentPosts = posts.filter((post) => post.slug !== featuredPost?.slug);
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
      image: [post.coverImageUrl],
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

      <main className="mx-auto max-w-3xl px-5 sm:px-6">
        {/* Header */}
        <header className="pb-10 pt-14 sm:pt-20">
          <h1 className="text-[2rem] font-bold tracking-tight text-[#111] sm:text-[2.5rem] dark:text-white">
            Blog
          </h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-[#555] dark:text-[#999]">
            Practical guides on creator contracts, inbox workflows, payment
            tracking, and partnership operations.
          </p>
        </header>

        {/* Featured */}
        {featuredPost ? (
          <Link
            href={`/blog/${featuredPost.slug}`}
            className="group block border-b border-t border-[#e8e8e8] py-10 dark:border-[#222]"
          >
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary dark:bg-primary/20">
              Featured
            </span>
            <h2 className="mt-4 text-[1.5rem] font-bold leading-snug tracking-tight text-[#111] group-hover:text-primary sm:text-[1.75rem] dark:text-white dark:group-hover:text-[#8ec6b1]">
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
          </Link>
        ) : null}

        {/* Posts list */}
        {recentPosts.length > 0 ? (
          <div className="divide-y divide-[#e8e8e8] dark:divide-[#222]">
            {recentPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block py-8"
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
                <h3 className="mt-3 text-[1.2rem] font-bold leading-snug tracking-tight text-[#111] group-hover:text-primary sm:text-[1.35rem] dark:text-white dark:group-hover:text-[#8ec6b1]">
                  {post.title}
                </h3>
                <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-[#555] dark:text-[#999]">
                  {post.description}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary dark:text-[#8ec6b1]">
                  Read article
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <blockquote className="border-t border-[#e8e8e8] py-8 dark:border-[#222]">
            <p className="max-w-2xl text-[1rem] leading-relaxed text-[#555] dark:text-[#999]">
              "If a deal changes your future earning power, it should change the fee.
              Rights, exclusivity, and usage are never throwaway details."
            </p>
          </blockquote>
        )}
      </main>
    </div>
  );
}
