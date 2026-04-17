import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null, currency = "USD") {
  if (amount === null || Number.isNaN(amount)) {
    return "Not specified";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function humanizeToken(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (part) => part.toUpperCase());
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function stripHtmlTags(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|table)>/gi, "\n")
    .replace(/<(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function sanitizePlainTextInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(value)
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(ul|ol)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|tr|li|table|ul|ol|section|article)>/gi, "\n")
    .replace(/<(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeEvidenceSnippet(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = stripHtmlTags(value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) {
    return null;
  }

  const compact = cleaned.replace(/\s+/g, " ").trim();

  if (compact.length < 8) {
    return null;
  }

  if (!/[a-z]/i.test(compact)) {
    return null;
  }

  if (/^\(?\d+[.)]?\)?$/.test(compact)) {
    return null;
  }

  if (/^[ivxlcdm]+[.)]?$/i.test(compact)) {
    return null;
  }

  if (/^(page|pages?)\s+\d+(\s+of\s+\d+)?$/i.test(compact)) {
    return null;
  }

  if (/^(section|clause|item|bullet)\s+\d+[a-z]?[.)-]?$/i.test(compact)) {
    return null;
  }

  return cleaned;
}
