import type { EmailThreadListItem } from "@/lib/types";

export type InboxSortOption = "newest" | "oldest" | "subject";

export function normalizeInboxSort(value: string | null | undefined): InboxSortOption {
  switch (value) {
    case "oldest":
    case "subject":
      return value;
    case "newest":
    default:
      return "newest";
  }
}

export function sortInboxThreadItems<T extends Pick<EmailThreadListItem, "thread">>(
  items: T[],
  sort: InboxSortOption
) {
  const sorted = [...items];

  sorted.sort((left, right) => {
    switch (sort) {
      case "oldest":
        return left.thread.lastMessageAt.localeCompare(right.thread.lastMessageAt);
      case "subject":
        return left.thread.subject.localeCompare(right.thread.subject, undefined, {
          sensitivity: "base"
        });
      case "newest":
      default:
        return right.thread.lastMessageAt.localeCompare(left.thread.lastMessageAt);
    }
  });

  return sorted;
}
