"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  formatNotificationRelativeTime,
  NOTIFICATIONS_READ_EVENT,
  loadReadNotificationIds,
  persistReadNotificationIds,
  type NotificationItem,
  type NotificationType
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

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

export function NotificationsCenter({
  notifications
}: {
  notifications: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadNotificationIds);

  const previewItems = useMemo(() => notifications.slice(0, 6), [notifications]);
  const unreadCount = useMemo(
    () => notifications.filter((item) => !readIds.has(item.id)).length,
    [notifications, readIds]
  );

  useEffect(() => {
    const syncReadIds = () => setReadIds(loadReadNotificationIds());

    window.addEventListener(NOTIFICATIONS_READ_EVENT, syncReadIds);
    window.addEventListener("storage", syncReadIds);

    return () => {
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, syncReadIds);
      window.removeEventListener("storage", syncReadIds);
    };
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(id);
      persistReadNotificationIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(() => {
      const next = new Set(notifications.map((item) => item.id));
      persistReadNotificationIds(next);
      return next;
    });
  }, [notifications]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-label="Open notifications"
        onClick={() => setOpen(true)}
        data-guide="header-notifications"
        className="relative inline-flex items-center justify-center p-0 text-black/65 transition-colors outline-none hover:text-foreground focus-visible:ring-0 dark:text-white/70 dark:hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
        ) : null}
      </button>

      <SheetContent side="right" className="w-full gap-0 border-l border-border px-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <SheetTitle className="text-lg">Notifications</SheetTitle>
              <SheetDescription className="mt-1">
                Quick updates from your deals, deadlines, and payments.
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={notifications.length === 0 || unreadCount === 0}
            >
              Mark all read
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {previewItems.length === 0 ? (
            <div className="flex h-full min-h-[280px] items-center justify-center px-6 text-center">
              <p className="max-w-[240px] text-sm text-muted-foreground">
                You&apos;re all caught up. New notifications will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {previewItems.map((item) => {
                const Icon = TYPE_ICONS[item.type];
                const isUnread = !readIds.has(item.id);

                return (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 shrink-0", TYPE_COLORS[item.type])}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="mt-1 h-2 w-2 shrink-0">
                        {isUnread ? <div className="h-2 w-2 rounded-full bg-red-500" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className={cn(
                              "text-sm text-foreground",
                              isUnread ? "font-semibold" : "font-medium"
                            )}
                          >
                            {item.title}
                          </p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatNotificationRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <SheetClose asChild>
                            <Link
                              href={`/app/deals/${item.dealId}`}
                              onClick={() => markRead(item.id)}
                              className="text-xs font-medium text-foreground transition hover:text-primary"
                            >
                              View details
                            </Link>
                          </SheetClose>
                          {isUnread ? (
                            <button
                              type="button"
                              onClick={() => markRead(item.id)}
                              className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <SheetClose asChild>
            <Link
              href="/app/settings/notifications"
              className="inline-flex text-sm font-medium text-foreground transition hover:text-primary"
            >
              View more
            </Link>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
