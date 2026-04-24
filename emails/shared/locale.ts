/**
 * This file normalizes app-supported locales for React Email templates.
 * It keeps BCP-47 parsing and fallback behavior in one place for email rendering.
 */
import { routing } from "@/i18n/routing";

export type EmailLocale = (typeof routing.locales)[number];

const supportedLocales = new Set<string>(routing.locales);

export function resolveEmailLocale(input: string | null | undefined): EmailLocale {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) {
    return routing.defaultLocale;
  }

  if (supportedLocales.has(normalized)) {
    return normalized as EmailLocale;
  }

  const baseLocale = normalized.split("-")[0];
  if (baseLocale && supportedLocales.has(baseLocale)) {
    return baseLocale as EmailLocale;
  }

  return routing.defaultLocale;
}
