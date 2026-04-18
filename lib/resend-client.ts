import {
  isLocalHostname,
  logOutboundNetworkDiagnostics,
  normalizeUrl,
} from "@/lib/network/env-diagnostics";

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
  logOutboundNetworkDiagnostics({
    service: "resend",
    urlEnvVars: ["RESEND_BASE_URL"],
    effectiveHosts: {
      api: normalizeUrl(process.env.RESEND_BASE_URL)?.hostname ?? "api.resend.com",
    },
  });
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}
