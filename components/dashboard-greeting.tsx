"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type GreetingTranslator = (key: "morning" | "afternoon" | "evening" | "welcomeBack") => string;

function greetingForHour(hour: number, t: GreetingTranslator) {
  if (hour < 12) {
    return t("morning");
  }

  if (hour < 18) {
    return t("afternoon");
  }

  return t("evening");
}

export function DashboardGreeting({ firstName }: { firstName: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const locale = useLocale();
  const t = useTranslations("appDashboard.greeting");

  useEffect(() => {
    const updateNow = () => setNow(new Date());

    updateNow();

    const interval = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const greeting = now ? greetingForHour(now.getHours(), t) : t("welcomeBack");
  const dashboardDate = now
    ? new Intl.DateTimeFormat(locale, {
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
