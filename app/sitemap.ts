import type { MetadataRoute } from "next";

import { getBlogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getBlogPosts();
  const latestPostDate = posts[0]?.updatedAt ?? posts[0]?.publishedAt;

  const staticRoutes = [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1
    },
    {
      url: absoluteUrl("/pricing"),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8
    },
    {
      url: absoluteUrl("/waitlist"),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: new Date("2026-03-25"),
      changeFrequency: "yearly" as const,
      priority: 0.3
    },
    {
      url: absoluteUrl("/blog"),
      lastModified: latestPostDate ? new Date(latestPostDate) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9
    }
  ];

  const postRoutes = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.75
  }));

  return [...staticRoutes, ...postRoutes];
}
