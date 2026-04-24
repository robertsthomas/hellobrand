/**
 * This file exposes the locale-indexed message catalog for React Email templates.
 * It keeps email templates aligned with the app's existing next-intl message files.
 */
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";

import type { EmailLocale } from "./locale";

export const emailMessagesByLocale: Record<EmailLocale, typeof en> = {
  en,
  es,
  fr,
};
