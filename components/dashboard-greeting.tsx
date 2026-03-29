"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function DashboardGreeting({ firstName }: { firstName: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(new Date());

    updateNow();

    const interval = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const greeting = now ? greetingForHour(now.getHours()) : "Welcome back";
  const dashboardDate = now
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "2-digit"
      }).format(now)
    : "";

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{dashboardDate}</p>
      <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.05em] text-foreground lg:text-[34px]">
        {greeting}, {firstName}
      </h1>
    </div>
  );
}
