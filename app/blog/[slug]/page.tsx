import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { BlogSummarizeButton } from "@/components/blog-summarize-button";
import { blogSummarizeEnabled } from "@/flags";
import { MarketingNav } from "@/components/marketing-nav";
import {
  getBlogPostBySlug,
  getBlogPostOgImageUrl,
  getBlogPostPlainText,
  getBlogPosts,
  getBlogPostUrl,
  getBlogPostWordCount,
} from "@/lib/blog";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { formatDate, slugify } from "@/lib/utils";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return getBlogPosts().map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Post not found | HelloBrand",
    };
  }

  return {
    title: `${post.title} | HelloBrand`,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    creator: post.author,
    category: post.category,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: getBlogPostUrl(post.slug),
      siteName: siteConfig.name,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      section: post.category,
      tags: post.keywords,
      images: [
        {
          url: getBlogPostOgImageUrl(post.slug),
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [getBlogPostOgImageUrl(post.slug)],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const coverImageAbsoluteUrl = post.coverImageUrl.startsWith("http")
    ? post.coverImageUrl
    : absoluteUrl(post.coverImageUrl);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: [coverImageAbsoluteUrl, getBlogPostOgImageUrl(post.slug)],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    articleSection: post.category,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: absoluteUrl("/"),
    },
    mainEntityOfPage: getBlogPostUrl(post.slug),
    keywords: post.keywords.join(", "),
    wordCount: getBlogPostWordCount(post),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Blog",
        item: absoluteUrl("/blog"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: post.title,
        item: getBlogPostUrl(post.slug),
      },
    ],
  };
  const articlePlainText = getBlogPostPlainText(post);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1115]">
      <MarketingNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#888] transition hover:text-[#111] dark:text-[#666] dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All posts
        </Link>

        {/* Post header */}
        <header className="mt-8 border-b border-[#e8e8e8] pb-8 dark:border-[#222]">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary dark:bg-primary/20">
            {post.category}
          </span>
          <h1 className="mt-5 text-[2rem] font-bold leading-tight tracking-tight text-[#111] sm:text-[2.5rem] dark:text-white">
            {post.title}
          </h1>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-[#555] dark:text-[#999]">
            {post.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#e3dccb] bg-[#f9f6ee] px-3 py-1 text-[11px] font-medium tracking-[0.01em] text-[#5b5140] dark:border-[#2a2d31] dark:bg-[#111418] dark:text-[#a3abb6]"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#888] dark:text-[#666]">
              <span>By {post.author}</span>
              <span aria-hidden="true">&middot;</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              <span aria-hidden="true">&middot;</span>
              <span>{post.readingTime}</span>
            </div>
            {(await blogSummarizeEnabled()) === true ? (
              <BlogSummarizeButton
                cacheKey={post.slug}
                title={post.title}
                description={post.description}
                articleText={articlePlainText}
              />
            ) : null}
          </div>
          <figure className="mt-8 overflow-hidden rounded-[1.8rem] border border-[#ececec] bg-[#f4f1eb] dark:border-[#222]">
            <div className="relative aspect-[16/9]">
              <Image
                src={post.coverImageUrl}
                alt={post.coverImageAlt}
                fill
                priority
                unoptimized={!post.coverImageUrl.startsWith("http")}
                sizes="(min-width: 1024px) 768px, 100vw"
                className="object-cover"
              />
            </div>
            {post.coverImageCreditName && post.coverImageCreditUrl ? (
              <figcaption className="px-4 py-3 text-[12px] text-[#888] dark:text-[#666]">
                Photo by{" "}
                <a
                  href={post.coverImageCreditUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#555] transition hover:text-primary dark:text-[#999] dark:hover:text-[#8ec6b1]"
                >
                  {post.coverImageCreditName}
                </a>{" "}
                on Unsplash
              </figcaption>
            ) : null}
          </figure>
        </header>

        {/* Table of contents */}
        {post.sections.length > 2 ? (
          <nav className="border-b border-[#e8e8e8] py-6 dark:border-[#222]">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-[#888] dark:text-[#666]">
              In this article
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {post.sections.map((section, index) => (
                <li key={section.heading}>
                  <a
                    href={`#${slugify(section.heading)}`}
                    className="text-[14px] text-[#555] transition hover:text-primary dark:text-[#999] dark:hover:text-[#8ec6b1]"
                  >
                    {index + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {/* Article body */}
        <article className="mt-10 space-y-12">
          {post.sections.map((section) => (
            <section key={section.heading} id={slugify(section.heading)} className="scroll-mt-24">
              <h2 className="text-[1.4rem] font-bold tracking-tight text-[#111] sm:text-[1.55rem] dark:text-white">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4 text-[1rem] leading-[1.8] text-[#444] dark:text-[#bbb]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets?.length ? (
                <ul className="mt-5 space-y-2.5 text-[0.95rem] leading-[1.7] text-[#444] dark:text-[#bbb]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60 dark:bg-[#8ec6b1]/60" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        {/* CTA */}
        <section className="mt-16 rounded-2xl border border-[#e8e8e8] bg-[#f9f7f2] p-8 text-center dark:border-[#222] dark:bg-[#141920]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-primary dark:text-[#8ec6b1]">
            Ready to review your own contract?
          </p>
          <h2 className="mt-3 text-[1.5rem] font-bold tracking-tight text-[#111] sm:text-[1.75rem] dark:text-white">
            Upload your brand deal for a free breakdown.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[0.95rem] leading-relaxed text-[#555] dark:text-[#999]">
            Get the summary, risk flags, and payment terms from your own contract in seconds. No signup required.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/upload"
              className="inline-flex h-11 items-center gap-2 bg-primary px-6 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/92"
            >
              Upload Your Contract
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sample"
              className="inline-flex h-11 items-center gap-2 border border-[#ddd] bg-white px-6 text-[14px] font-semibold text-[#333] transition hover:bg-[#f5f3ee] dark:border-[#333] dark:bg-[#1a1f27] dark:text-[#ccc] dark:hover:bg-[#1e2530]"
            >
              Try a Sample
            </Link>
          </div>
        </section>

        {/* Related posts */}
        <RelatedPosts currentSlug={slug} />

        {/* Bottom nav */}
        <div className="mt-16 border-t border-[#e8e8e8] pt-8 dark:border-[#222]">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary transition hover:text-primary/80 dark:text-[#8ec6b1]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to all posts
          </Link>
        </div>
      </main>
    </div>
  );
}

function RelatedPosts({ currentSlug }: { currentSlug: string }) {
  const allPosts = getBlogPosts();
  const related = allPosts
    .filter((p) => p.slug !== currentSlug)
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <section className="mt-12">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#888] dark:text-[#666]">
        Related articles
      </p>
      <div className="mt-5 space-y-5">
        {related.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block px-4 py-5 transition-colors hover:bg-[#fbf8f0] rounded-lg sm:px-5 dark:hover:bg-[#13161b]"
          >
            <div className="flex items-center gap-3 text-[13px] text-[#888] dark:text-[#666]">
              <span>{post.category}</span>
              <span aria-hidden="true">&middot;</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              <span aria-hidden="true">&middot;</span>
              <span>{post.readingTime}</span>
            </div>
            <h3 className="mt-2 text-[1.1rem] font-bold leading-snug tracking-tight text-[#111] dark:text-white">
              {post.title}
            </h3>
            <p className="mt-1 max-w-xl text-[0.9rem] leading-relaxed text-[#555] dark:text-[#999]">
              {post.description}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary dark:text-[#8ec6b1]">
              Read article
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
