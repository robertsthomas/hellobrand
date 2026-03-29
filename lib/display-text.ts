import { stripInlineMarkdown } from "@/lib/deal-summary";

export function cleanDisplayText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = stripInlineMarkdown(value).replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}
