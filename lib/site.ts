const DEFAULT_SITE_URL = "http://localhost:3011";

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim() || DEFAULT_SITE_URL;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getSiteUrl() {
  return normalizeUrl(
    process.env.NEXT_PUBLIC_APP_URL || process.env.INTEGRATIONS_APP_URL
  );
}

export function absoluteUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export const siteConfig = {
  name: "HelloBrand",
  description:
    "HelloBrand helps creators manage contracts, brand emails, deliverables, and payments in one sunny workspace."
};
