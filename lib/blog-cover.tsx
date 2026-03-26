import { ImageResponse } from "next/og";

import type { BlogPost } from "@/lib/blog";

export const BLOG_POST_COVER_SIZE = {
  width: 1200,
  height: 630
};

export const BLOG_POST_COVER_CONTENT_TYPE = "image/png";

export function createBlogPostCoverImage(post: BlogPost) {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at top left, #f4d36f 0%, #fbf5e7 38%, #ffffff 100%)",
          padding: "64px",
          color: "#142033"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontSize: 24,
            fontWeight: 700,
            color: "#5b6574"
          }}
        >
          <span
            style={{
              borderRadius: 999,
              background: "#1a4d3e",
              color: "#fff",
              padding: "8px 18px"
            }}
          >
            {post.category}
          </span>
          <span>{post.readingTime}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#8b6d3b"
            }}
          >
            HelloBrand Blog
          </div>
          <div
            style={{
              maxWidth: 980,
              fontSize: 68,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.05em"
            }}
          >
            {post.title}
          </div>
          <div
            style={{
              maxWidth: 980,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#4d596d"
            }}
          >
            {post.description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#5b6574"
          }}
        >
          <span>{post.author}</span>
          <span>{post.publishedAt}</span>
        </div>
      </div>
    ),
    BLOG_POST_COVER_SIZE
  );
}
