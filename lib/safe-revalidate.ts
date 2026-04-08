import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Safely call Next.js revalidation APIs. When called from a fire-and-forget
 * background promise (no active request context), revalidateTag throws
 * "Invariant: static generation store missing". This wrapper silently catches
 * that error since the cache will be refreshed on the next request anyway.
 */
export function safeRevalidateTag(tag: string) {
  try {
    revalidateTag(tag, "max");
  } catch {
    // No active request context; cache refreshes on next request
  }
}

export function safeRevalidatePath(path: string, type?: "layout" | "page") {
  try {
    revalidatePath(path, type);
  } catch {
    // No active request context
  }
}
