"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";

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
      setActiveTab(urlTab);

      requestAnimationFrame(() => {
        document.getElementById(`tab-${urlTab}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    }
  }, [searchParams]);

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
      document.getElementById(`tab-${value}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-6">
      {children}
    </Tabs>
  );
}
