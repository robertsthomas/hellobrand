"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Settings
} from "lucide-react";
import type { NotificationItem, NotificationType } from "@/app/app/settings/notifications/page";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "hellobrand:notifications:read";

type FilterTab = "all" | "unread" | "payments" | "deadlines" | "risks";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "payments", label: "Payments" },
  { key: "deadlines", label: "Deadlines" },
  { key: "risks", label: "Risks" }
];

const TYPE_ICONS: Record<NotificationType, typeof DollarSign> = {
  payment_overdue: DollarSign,
  upcoming_deadline: Calendar,
  contract_risk: AlertTriangle,
  deliverable_approved: CheckCircle2,
  new_contract: FileText,
  payment_received: DollarSign
};

const TYPE_COLORS: Record<NotificationType, string> = {
  payment_overdue: "text-red-500",
  upcoming_deadline: "text-orange-500",
  contract_risk: "text-amber-500",
  deliverable_approved: "text-emerald-500",
  new_contract: "text-blue-500",
  payment_received: "text-emerald-500"
};

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable
  }
}

function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function matchesFilter(
  item: NotificationItem,
  filter: FilterTab,
  readIds: Set<string>
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unread":
      return !readIds.has(item.id);
    case "payments":
      return item.type === "payment_overdue" || item.type === "payment_received";
    case "deadlines":
      return item.type === "upcoming_deadline";
    case "risks":
      return item.type === "contract_risk";
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
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        persistReadIds(next);
        return next;
      });
    },
    []
  );

  const markAllRead = useCallback(() => {
    setReadIds(() => {
      const next = new Set(notifications.map((n) => n.id));
      persistReadIds(next);
      return next;
    });
  }, [notifications]);

  const clearRead = useCallback(() => {
    setReadIds(() => {
      persistReadIds(new Set());
      return new Set();
    });
  }, []);

  const filtered = useMemo(
    () => notifications.filter((n) => matchesFilter(n, activeFilter, readIds)),
    [notifications, activeFilter, readIds]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: notifications.length,
      unread: notifications.filter((n) => !readIds.has(n.id)).length,
      payments: notifications.filter(
        (n) => n.type === "payment_overdue" || n.type === "payment_received"
      ).length,
      deadlines: notifications.filter((n) => n.type === "upcoming_deadline").length,
      risks: notifications.filter((n) => n.type === "contract_risk").length
    };
    return counts;
  }, [notifications, readIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-2 text-muted-foreground">
            Stay updated on your partnerships and contracts
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
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark All Read
          </Button>
          <Button variant="outline" size="sm" onClick={clearRead}>
            Clear Read
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
            const color = TYPE_COLORS[item.type];
            const isUnread = !readIds.has(item.id);

            return (
              <div
                key={item.id}
                className="flex items-start gap-4 border-b border-black/8 px-5 py-4 transition-colors last:border-b-0 hover:bg-[#f6f7f8] dark:border-white/8 dark:hover:bg-white/[0.04]"
              >
                <div className={`mt-0.5 shrink-0 ${color}`}>
                  <Icon className="h-5 w-5" />
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
                    {relativeTime(item.createdAt)}
                  </span>
                  <Link
                    href={`/app/deals/${item.dealId}`}
                    className="text-xs font-medium text-foreground transition hover:text-primary"
                  >
                    View Details
                  </Link>
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      Mark Read
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
