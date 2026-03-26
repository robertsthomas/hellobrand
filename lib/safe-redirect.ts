const DEFAULT_REDIRECT = "/app";

export function safeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT
) {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  if (trimmed.startsWith("//")) {
    return fallback;
  }

  if (trimmed.startsWith("/\\")) {
    return fallback;
  }

  return trimmed;
}
