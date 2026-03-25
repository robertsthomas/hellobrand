"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import {
  Check,
  Clock3,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Wallet,
  X,
  type LucideIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatNotificationRelativeTime,
  isNotificationUnread,
  type NotificationItem,
  type NotificationListResponse,
  type NotificationType
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread" | "payments" | "deadlines" | "risks" | "workspaces";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "workspaces", label: "Workspaces" },
  { key: "payments", label: "Payments" },
  { key: "deadlines", label: "Deadlines" },
  { key: "risks", label: "Risks" }
];

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  email_resync_required: RefreshCw,
  payment_overdue: Wallet,
  upcoming_deadline: Clock3,
  contract_risk: Shield,
  deliverable_approved: Check,
  new_contract: FileText,
  payment_received: Wallet,
  workspace_generating: LoaderCircle,
  workspace_checking_duplicates: LoaderCircle,
  workspace_ready: Check,
  workspace_failed: X,
  workspace_duplicate_found: Search,
  workspace_confirmed: Check,
  workspace_cancelled: X
};

const TYPE_ICON_STYLES: Record<NotificationType, string> = {
  email_resync_required: "text-[#8a8f98] dark:text-white/35",
  payment_overdue: "text-[#6b7280] dark:text-white/45",
  upcoming_deadline: "text-[#6b7280] dark:text-white/45",
  contract_risk: "text-[#7a6a4f] dark:text-white/50",
  deliverable_approved: "text-[#5f6f64] dark:text-white/50",
  new_contract: "text-[#6b7280] dark:text-white/45",
  payment_received: "text-[#5f6f64] dark:text-white/50",
  workspace_generating: "text-[#6b7280] dark:text-white/45",
  workspace_checking_duplicates: "text-[#6b7280] dark:text-white/45",
  workspace_ready: "text-[#5f6f64] dark:text-white/50",
  workspace_failed: "text-[#8a8f98] dark:text-white/35",
  workspace_duplicate_found: "text-[#7a6a4f] dark:text-white/50",
  workspace_confirmed: "text-[#5f6f64] dark:text-white/50",
  workspace_cancelled: "text-[#8a8f98] dark:text-white/35"
};

async function fetchNotifications() {
  const response = await fetch("/api/notifications?limit=200", {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Could not load notifications.");
  }

  return (await response.json()) as NotificationListResponse;
}

function matchesFilter(item: NotificationItem, filter: FilterTab): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unread":
      return isNotificationUnread(item);
    case "payments":
      return item.category === "payments";
    case "deadlines":
      return item.category === "deadlines";
    case "risks":
      return item.category === "risks";
    case "workspaces":
      return item.category === "workspace";
    default:
      return true;
  }
}

export function NotificationsView({
  notifications
}: {
  notifications: NotificationItem[];
}) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<NotificationItem[]>(notifications);
  const [unreadCount, setUnreadCount] = useState(
    notifications.filter(isNotificationUnread).length
  );

  type OptimisticAction =
    | { type: "mark_read"; id: string }
    | { type: "mark_unread"; id: string }
    | { type: "clear"; id: string }
    | { type: "mark_all_read" }
    | { type: "clear_all" };

  const [optimisticItems, applyOptimistic] = useOptimistic(
    items,
    (current, action: OptimisticAction) => {
      switch (action.type) {
        case "mark_read":
          return current.map((n) =>
            n.id === action.id ? { ...n, readAt: new Date().toISOString(), read: true } : n
          );
        case "mark_unread":
          return current.map((n) =>
            n.id === action.id ? { ...n, readAt: null, read: false } : n
          );
        case "clear":
          return current.filter((n) => n.id !== action.id);
        case "mark_all_read":
          return current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString(), read: true }));
        case "clear_all":
          return [];
      }
    }
  );

  useEffect(() => {
    setItems(notifications);
    setUnreadCount(notifications.filter(isNotificationUnread).length);
  }, [notifications]);

  const refresh = useCallback(async () => {
    const next = await fetchNotifications();
    setItems(next.notifications);
    setUnreadCount(next.unreadCount);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const markNotification = useCallback(
    (id: string, action: "mark_read" | "mark_unread" | "clear") => {
      startTransition(async () => {
        applyOptimistic({ type: action, id });

        const response = await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        });

        if (!response.ok) {
          await refresh();
          return;
        }

        await refresh();
      });
    },
    [applyOptimistic, refresh]
  );

  const markAllRead = useCallback(() => {
    startTransition(async () => {
      applyOptimistic({ type: "mark_all_read" });

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" })
      });

      if (!response.ok) {
        await refresh();
        return;
      }

      await refresh();
    });
  }, [applyOptimistic, refresh]);

  const clearAll = useCallback(() => {
    startTransition(async () => {
      applyOptimistic({ type: "clear_all" });

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" })
      });

      if (!response.ok) {
        await refresh();
        return;
      }

      await refresh();
    });
  }, [applyOptimistic, refresh]);

  const optimisticUnreadCount = useMemo(
    () => optimisticItems.filter(isNotificationUnread).length,
    [optimisticItems]
  );

  const filtered = useMemo(
    () => optimisticItems.filter((item) => matchesFilter(item, activeFilter)),
    [optimisticItems, activeFilter]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: optimisticItems.length,
      unread: optimisticUnreadCount,
      workspaces: optimisticItems.filter((item) => item.category === "workspace").length,
      payments: optimisticItems.filter((item) => item.category === "payments").length,
      deadlines: optimisticItems.filter((item) => item.category === "deadlines").length,
      risks: optimisticItems.filter((item) => item.category === "risks").length
    };
    return counts;
  }, [optimisticItems, optimisticUnreadCount]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-2 text-muted-foreground">
            Stay updated on your workspaces, deadlines, payments, and partnership activity.
          </p>
        </div>
        <Button variant="outline" size="icon" aria-label="Notification settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex h-10 items-center gap-1 rounded-md border border-black/8 bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                activeFilter === tab.key
                  ? "bg-[#111827] text-white shadow-sm dark:bg-white dark:text-[#111827]"
                  : "text-[#667085] hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="text-xs opacity-60">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={isPending || optimisticItems.length === 0 || optimisticUnreadCount === 0}
          >
            Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={isPending || optimisticItems.length === 0}
          >
            Clear all
          </Button>
        </div>
      </div>

      <div className="border border-black/8 bg-white dark:border-white/10 dark:bg-[#15191f]">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {activeFilter === "all"
                ? "You're all caught up. New notifications will show up here."
                : `No ${activeFilter === "unread" ? "unread" : activeFilter} notifications.`}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            const isUnread = isNotificationUnread(item);

            return (
              <div
                key={item.id}
                className="flex items-start gap-4 border-b border-black/8 px-5 py-4 transition-colors last:border-b-0 hover:bg-[#f6f7f8] dark:border-white/8 dark:hover:bg-white/[0.04]"
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center",
                    TYPE_ICON_STYLES[item.type]
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] stroke-[1.7]",
                      item.status === "active" &&
                        (item.type === "workspace_generating" ||
                          item.type === "workspace_checking_duplicates") &&
                        "animate-spin"
                    )}
                  />
                </div>

                {isUnread ? (
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                ) : (
                  <div className="mt-2 h-2 w-2 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"} text-foreground`}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatNotificationRelativeTime(item.createdAt)}
                  </span>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (isUnread) {
                        markNotification(item.id, "mark_read");
                      }
                    }}
                    className="text-xs font-medium text-foreground transition hover:text-primary"
                  >
                    View details
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      markNotification(item.id, isUnread ? "mark_read" : "mark_unread")
                    }
                    className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    {isUnread ? "Mark read" : "Mark unread"}
                  </button>
                  <button
                    type="button"
                    onClick={() => markNotification(item.id, "clear")}
                    className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
