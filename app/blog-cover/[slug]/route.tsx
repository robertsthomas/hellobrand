import { notFound } from "next/navigation";

import { getBlogPostBySlug } from "@/lib/blog";
import {
  BLOG_POST_COVER_CONTENT_TYPE,
  BLOG_POST_COVER_SIZE,
  createBlogPostCoverImage
} from "@/lib/blog-cover";

const contentType = BLOG_POST_COVER_CONTENT_TYPE;
const size = BLOG_POST_COVER_SIZE;

type BlogPostCoverRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_: Request, { params }: BlogPostCoverRouteProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return createBlogPostCoverImage(post);
}
