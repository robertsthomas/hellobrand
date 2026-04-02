"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";

function scrollActiveTabIntoView(tab: string) {
  const panel = document.getElementById(`tab-${tab}`);
  if (!panel) return;

  const scrollContainer =
    panel.closest<HTMLElement>("[data-workspace-scroll-container]") ??
    document.querySelector<HTMLElement>("[data-workspace-scroll-container]");

  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const top = scrollContainer.scrollTop + (panelRect.top - containerRect.top) - 24;

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

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);

    // Update URL bar without triggering any navigation or server re-render
    const params = new URLSearchParams(window.location.search);
    if (value === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }

    const query = params.toString();
    const url = window.location.pathname + (query ? `?${query}` : "");
    window.history.replaceState(null, "", url);

    requestAnimationFrame(() => {
      scrollActiveTabIntoView(value);
    });
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-6">
      {children}
    </Tabs>
  );
}
