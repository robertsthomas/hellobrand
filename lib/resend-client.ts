function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

export function shouldIgnoreResendBaseUrl(baseUrl: string | null | undefined) {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const parsed = normalizeUrl(baseUrl);
  if (!parsed) {
    return false;
  }

  return isLocalHostname(parsed.hostname);
}

export function sanitizeResendBaseUrlEnv() {
  const baseUrl = process.env.RESEND_BASE_URL;
  if (!shouldIgnoreResendBaseUrl(baseUrl)) {
    return;
  }

  console.warn(
    `Ignoring RESEND_BASE_URL=${baseUrl} in production because it points to a local address.`
  );
  delete process.env.RESEND_BASE_URL;
}

export async function createResendClient(apiKey: string) {
  sanitizeResendBaseUrlEnv();
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}
