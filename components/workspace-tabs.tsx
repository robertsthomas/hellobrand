"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";

const WORKSPACE_TAB_CHANGE_EVENT = "workspace-tab-change";

function buildWorkspaceTabUrl(value: string) {
  const params = new URLSearchParams(window.location.search);
  if (value === "overview") {
    params.delete("tab");
  } else {
    params.set("tab", value);
  }

  const query = params.toString();
  return window.location.pathname + (query ? `?${query}` : "");
}

function openWorkspaceTab(value: string) {
  const url = buildWorkspaceTabUrl(value);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_TAB_CHANGE_EVENT, {
      detail: { tab: value },
    })
  );

  requestAnimationFrame(() => {
    scrollActiveTabIntoView(value);
  });
}

function scrollActiveTabIntoView(tab: string) {
  const panel = document.getElementById(`tab-${tab}`);
  if (!panel) return;

  const scrollContainer =
    panel.closest<HTMLElement>("[data-workspace-scroll-container]") ??
    document.querySelector<HTMLElement>("[data-workspace-scroll-container]");

  if (scrollContainer) {
    const tabBar = scrollContainer.querySelector<HTMLElement>("[data-guide='workspace-tabs']");
    if (!tabBar) return;

    const tabBarRect = tabBar.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();

    const tabBarVisible =
      tabBarRect.top >= containerRect.top &&
      tabBarRect.bottom <= containerRect.bottom;

    if (tabBarVisible) return;

    const tabBarHeight = tabBarRect.height;
    const panelRect = panel.getBoundingClientRect();
    const top = scrollContainer.scrollTop + (panelRect.top - containerRect.top) - tabBarHeight - 16;

    scrollContainer.scrollTo({
      top: Math.max(0, top),
      left: 0,
      behavior: "smooth"
    });

    return;
  }

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

export function WorkspaceTabs({
  defaultTab,
  children
}: {
  defaultTab: string;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Sync from URL on mount (e.g., arriving from a nudge notification link)
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== activeTab) {
      const syncTimer = window.setTimeout(() => {
        setActiveTab(urlTab);
      }, 0);

      const frame = window.requestAnimationFrame(() => {
        scrollActiveTabIntoView(urlTab);
      });

      return () => {
        window.clearTimeout(syncTimer);
        window.cancelAnimationFrame(frame);
      };
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    const handleWorkspaceTabChange = (event: Event) => {
      const nextTab =
        event instanceof CustomEvent && typeof event.detail?.tab === "string"
          ? event.detail.tab
          : null;

      if (!nextTab || nextTab === activeTab) {
        return;
      }

      setActiveTab(nextTab);
    };

    window.addEventListener(WORKSPACE_TAB_CHANGE_EVENT, handleWorkspaceTabChange);
    return () => {
      window.removeEventListener(WORKSPACE_TAB_CHANGE_EVENT, handleWorkspaceTabChange);
    };
  }, [activeTab]);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    openWorkspaceTab(value);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-6">
      {children}
    </Tabs>
  );
}

export function WorkspaceTabButton({
  tab,
  className,
  children,
}: {
  tab: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => openWorkspaceTab(tab)}
      className={className}
    >
      {children}
    </button>
  );
}
