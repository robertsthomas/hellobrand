const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

function normalizeHost(value: string | undefined | null) {
  const trimmed = value?.trim() || DEFAULT_POSTHOG_HOST;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function isLocalAppUrl(value: string | undefined | null) {
  const trimmed = value?.trim() || "";
  return (
    trimmed.startsWith("http://localhost") ||
    trimmed.startsWith("http://127.0.0.1")
  );
}

export function isPostHogClientEnabled() {
  return (
    process.env.NODE_ENV !== "development" &&
    !isLocalAppUrl(process.env.NEXT_PUBLIC_APP_URL) &&
    process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT !== "development" &&
    process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT !== "dev"
  );
}

function isPostHogServerEnabled() {
  return (
    process.env.NODE_ENV !== "development" &&
    !isLocalAppUrl(process.env.NEXT_PUBLIC_APP_URL) &&
    process.env.POSTHOG_ENVIRONMENT !== "development" &&
    process.env.POSTHOG_ENVIRONMENT !== "dev" &&
    process.env.VERCEL_ENV !== "development" &&
    process.env.DOPPLER_CONFIG !== "dev" &&
    process.env.DOPPLER_ENVIRONMENT !== "dev"
  );
}

export function getPostHogClientKey() {
  if (!isPostHogClientEnabled()) {
    return null;
  }

  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || null;
}

export function getPostHogClientHost() {
  return normalizeHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export function getPostHogServerKey() {
  if (!isPostHogServerEnabled()) {
    return null;
  }

  return process.env.POSTHOG_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || null;
}

export function getPostHogServerHost() {
  return normalizeHost(process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export function isPostHogConfigured() {
  return Boolean(getPostHogClientKey());
}
