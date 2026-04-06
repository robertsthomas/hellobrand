"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Check,
  Clock3,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  Shield,
  Wallet,
  X,
  type LucideIcon
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  isNotificationUnread,
  type NotificationItem,
  type NotificationListResponse,
  type NotificationType
} from "@/lib/notifications";
import { WORKSPACE_GENERATION_NOTIFICATION_EVENT } from "@/lib/workspace-generation-hint";
import { cn } from "@/lib/utils";

type WorkspaceNotificationEventDetail =
  | {
      action: "upsert";
      notification: NotificationItem;
      showHint?: boolean;
      replaceId?: string;
    }
  | {
      action: "remove";
      notificationId: string;
    };

function mergeNotificationItems(
  current: NotificationItem[],
  nextItem: NotificationItem,
  replaceId?: string
) {
  const existingIndex = current.findIndex(
    (item) =>
      item.id === replaceId ||
      item.id === nextItem.id ||
      (item.sessionId !== null &&
        nextItem.sessionId !== null &&
        item.sessionId === nextItem.sessionId &&
        item.eventType === nextItem.eventType)
  );

  if (existingIndex === -1) {
    return [nextItem, ...current];
  }

  return current.map((item, index) =>
    index === existingIndex ? { ...item, ...nextItem } : item
  );
}

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  email_resync_required: RefreshCw,
  payment_overdue: Wallet,
  invoice_generate_prompt: Wallet,
  invoice_send_prompt: Wallet,
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
  workspace_cancelled: X,
  workspace_missing_data: FileText
};

const TYPE_ICON_STYLES: Record<NotificationType, string> = {
  email_resync_required: "text-[#8a8f98] dark:text-white/35",
  payment_overdue: "text-[#6b7280] dark:text-white/45",
  invoice_generate_prompt: "text-[#6b7280] dark:text-white/45",
  invoice_send_prompt: "text-[#6b7280] dark:text-white/45",
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
  workspace_cancelled: "text-[#8a8f98] dark:text-white/35",
  workspace_missing_data: "text-[#7a6a4f] dark:text-white/50"
};

async function fetchNotifications() {
  const response = await fetch("/api/notifications?limit=100", {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Could not load notifications.");
  }

  return (await response.json()) as NotificationListResponse;
}

export function NotificationsCenter({
  notifications,
  hasEverCreatedWorkspace = false
}: {
  notifications: NotificationItem[];
  hasEverCreatedWorkspace?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showGenerationHint, setShowGenerationHint] = useState(false);
  const [pendingHintNotificationId, setPendingHintNotificationId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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

  const optimisticUnreadCount = useMemo(
    () => optimisticItems.filter(isNotificationUnread).length,
    [optimisticItems]
  );
  const previewItems = useMemo(() => optimisticItems.slice(0, 6), [optimisticItems]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    setIsMobileViewport(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (pathname !== "/app" || hasEverCreatedWorkspace) {
      setShowGenerationHint(false);
      setPendingHintNotificationId(null);
      return;
    }
  }, [hasEverCreatedWorkspace, pathname]);

  useEffect(() => {
    if (pathname !== "/app" || hasEverCreatedWorkspace || !pendingHintNotificationId) {
      return;
    }

    const hasNotificationInDrawer = previewItems.some(
      (item) => item.id === pendingHintNotificationId
    );

    if (!hasNotificationInDrawer) {
      return;
    }

    setShowGenerationHint(true);
    setPendingHintNotificationId(null);

    const timeoutId = window.setTimeout(() => {
      setShowGenerationHint(false);
    }, 7000);

    return () => window.clearTimeout(timeoutId);
  }, [hasEverCreatedWorkspace, pathname, pendingHintNotificationId, previewItems]);

  useEffect(() => {
    const handleWorkspaceNotificationEvent = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceNotificationEventDetail>).detail;

      if (!detail) {
        return;
      }

      if (detail.action === "remove") {
        setItems((current) =>
          current.filter((item) => item.id !== detail.notificationId)
        );
        setPendingHintNotificationId((current) =>
          current === detail.notificationId ? null : current
        );
        return;
      }

      setItems((current) =>
        mergeNotificationItems(current, detail.notification, detail.replaceId)
      );

      if (detail.showHint && !hasEverCreatedWorkspace) {
        setPendingHintNotificationId(detail.notification.id);
      }
    };

    window.addEventListener(
      WORKSPACE_GENERATION_NOTIFICATION_EVENT,
      handleWorkspaceNotificationEvent as EventListener
    );

    return () =>
      window.removeEventListener(
        WORKSPACE_GENERATION_NOTIFICATION_EVENT,
        handleWorkspaceNotificationEvent as EventListener
      );
  }, [hasEverCreatedWorkspace]);

  const refresh = useCallback(async () => {
    const next = await fetchNotifications();
    setItems(next.notifications);
    setUnreadCount(next.unreadCount);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [open, refresh]);

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

  const notificationTrigger = (
    <button
      type="button"
      aria-label="Open notifications"
      onClick={() => {
        setShowGenerationHint(false);
        setOpen(true);
      }}
      data-guide="header-notifications"
      className="relative inline-flex items-center justify-center p-0 text-black/65 transition-colors outline-none hover:text-foreground focus-visible:ring-0 dark:text-white/70 dark:hover:text-white"
    >
      <Bell className="h-5 w-5" />
      {optimisticUnreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
      ) : null}
    </button>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setShowGenerationHint(false);
          setPendingHintNotificationId(null);
        }

        setOpen(nextOpen);
      }}
    >
      {isMobileViewport ? (
        notificationTrigger
      ) : (
        <Popover open={showGenerationHint} onOpenChange={setShowGenerationHint}>
          <PopoverTrigger asChild>{notificationTrigger}</PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={14}
            className="border-black/10 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-[#1a1d24]"
          >
            <div className="absolute -top-1.5 right-8 h-3 w-3 rotate-45 border border-black/10 border-b-0 border-r-0 bg-white dark:border-white/10 dark:bg-[#1a1d24]" />
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink dark:text-white">
                Workspace generation started
              </h3>
              <button
                type="button"
                onClick={() => setShowGenerationHint(false)}
                className="shrink-0 rounded-sm p-1 text-black/40 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
                aria-label="Dismiss workspace generation tip"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-[13px] leading-5 text-black/60 dark:text-white/65">
              Check the notifications drawer for finished workspace generations.
            </p>
            <button
              type="button"
              onClick={() => setShowGenerationHint(false)}
              className={cn(
                buttonVariants({ size: "sm" }),
                "mt-3 h-9 w-full bg-primary text-xs text-primary-foreground hover:bg-primary/90"
              )}
            >
              Got it
            </button>
          </PopoverContent>
        </Popover>
      )}

      {isMobileViewport && showGenerationHint ? (
        <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+4.75rem)] z-40 border border-black/10 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-[#1a1d24]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Workspace generation started
            </h3>
            <button
              type="button"
              onClick={() => setShowGenerationHint(false)}
              className="shrink-0 rounded-sm p-1 text-black/40 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
              aria-label="Dismiss workspace generation tip"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[13px] leading-5 text-black/60 dark:text-white/65">
            Check the notifications drawer for finished workspace generations.
          </p>
          <button
            type="button"
            onClick={() => {
              setShowGenerationHint(false);
              setOpen(true);
            }}
            className={cn(
              buttonVariants({ size: "sm" }),
              "mt-3 h-9 w-full bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            )}
          >
            Open notifications
          </button>
        </div>
      ) : null}

      <SheetContent side="right" className="w-full gap-0 border-l border-border px-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <SheetTitle className="text-lg">Notifications</SheetTitle>
              <SheetDescription className="sr-only">Recent notifications</SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={markAllRead}
                disabled={isPending || optimisticItems.length === 0 || optimisticUnreadCount === 0}
              >
                Mark all read
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={isPending || optimisticItems.length === 0}
              >
                Clear all
              </Button>
            </div>
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
                const isUnread = isNotificationUnread(item);

                return (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center",
                          TYPE_ICON_STYLES[item.type]
                        )}
                      >
                        {item.status === "active" &&
                        (item.type === "workspace_generating" ||
                          item.type === "workspace_checking_duplicates") ? (
                          <span
                            className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-current/20 border-t-current"
                            aria-hidden="true"
                          />
                        ) : (
                          <Icon className="h-[18px] w-[18px] stroke-[1.7]" />
                        )}
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
                        <div className="mt-2 flex items-center gap-3">
                          <SheetClose asChild>
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
                          </SheetClose>
                          <button
                            type="button"
                            onClick={() =>
                              markNotification(
                                item.id,
                                isUnread ? "mark_read" : "mark_unread"
                              )
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
