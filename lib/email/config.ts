import type { EmailProvider } from "@/lib/types";

function normalizeBaseUrl(value: string | undefined) {
  const fallback = "http://localhost:3011";
  const normalized = value?.trim() || fallback;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function getAllowedEmailAppBaseUrls() {
  return Array.from(
    new Set(
      [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.INTEGRATIONS_APP_URL,
        "http://localhost:3011"
      ]
        .map((value) => normalizeBaseUrl(value))
        .filter(Boolean)
    )
  );
}

export function resolveEmailAppBaseUrl(value: string | null | undefined) {
  const normalized = normalizeBaseUrl(value ?? undefined);
  if (getAllowedEmailAppBaseUrls().includes(normalized)) {
    return normalized;
  }

  return getAppBaseUrl();
}

export function getAppBaseUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
}

export function getIntegrationBaseUrl() {
  return normalizeBaseUrl(
    process.env.INTEGRATIONS_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL
  );
}

export function getGoogleRedirectUri() {
  return `${getIntegrationBaseUrl()}/api/email/google/callback`;
}

export function getOutlookRedirectUri() {
  return `${getIntegrationBaseUrl()}/api/email/outlook/callback`;
}

export function getYahooRedirectUri() {
  return `${getIntegrationBaseUrl()}/api/email/yahoo/callback`;
}

export function getMicrosoftTenantId() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

export function getGooglePubSubTopic() {
  return process.env.GOOGLE_PUBSUB_TOPIC?.trim() || null;
}

export function getMicrosoftWebhookClientState() {
  return process.env.MICROSOFT_WEBHOOK_CLIENT_STATE?.trim() || null;
}

export function hasProviderConfig(provider: EmailProvider) {
  if (provider === "gmail") {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  if (provider === "outlook") {
    return Boolean(
      process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
    );
  }

  return Boolean(process.env.YAHOO_CLIENT_ID && process.env.YAHOO_CLIENT_SECRET);
}

export const gmailScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly"
];

export const outlookScopes = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.Read"
];

export const yahooScopes = [
  "openid",
  "profile",
  "email",
  "mail-r"
];

export function getEmailSummaryModel() {
  return (
    process.env.OPENROUTER_MODEL_EMAIL_SUMMARY ||
    process.env.LLM_MODEL_SUMMARY ||
    process.env.OPENROUTER_MODEL_SUMMARY ||
    process.env.LLM_MODEL ||
    process.env.OPENROUTER_MODEL ||
    "openai/gpt-5-chat"
  );
}

export function getEmailDraftModel() {
  return (
    process.env.OPENROUTER_MODEL_EMAIL_DRAFT ||
    process.env.LLM_MODEL_EMAIL_DRAFT ||
    "google/gemini-2.5-flash"
  );
}
