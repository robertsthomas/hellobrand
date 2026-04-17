"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { routing } from "@/i18n/routing";

function getCookieLocale() {
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const locale = match?.[1];

  return routing.locales.find((candidate) => candidate === locale) ?? routing.defaultLocale;
}

export function HtmlLangSync() {
  const pathname = usePathname();

  useEffect(() => {
    const localePrefix = pathname
      ?.split("/")
      .find((segment) => routing.locales.some((locale) => locale === segment));

    document.documentElement.lang = localePrefix ?? getCookieLocale();
  }, [pathname]);

  return null;
}
