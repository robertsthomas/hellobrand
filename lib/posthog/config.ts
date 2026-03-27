const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

function normalizeHost(value: string | undefined | null) {
  const trimmed = value?.trim() || DEFAULT_POSTHOG_HOST;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getPostHogClientKey() {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || null;
}

export function getPostHogClientHost() {
  return normalizeHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export function getPostHogServerKey() {
  return process.env.POSTHOG_KEY?.trim() || getPostHogClientKey();
}

export function getPostHogServerHost() {
  return normalizeHost(process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export function isPostHogConfigured() {
  return Boolean(getPostHogClientKey());
}
