import {
  isLocalHostname,
  normalizeUrl,
} from "@/lib/network/env-diagnostics";

const INNGEST_LOCAL_URL_ENV_VARS = [
  "INNGEST_BASE_URL",
  "INNGEST_API_BASE_URL",
  "INNGEST_EVENT_API_BASE_URL",
  "INNGEST_DEVSERVER_URL",
] as const;

type InngestUrlEnvVar = (typeof INNGEST_LOCAL_URL_ENV_VARS)[number];
type MutableEnv = Record<string, string | undefined>;

export function shouldIgnoreInngestUrlOverride(
  value: string | null | undefined,
  nodeEnv = process.env.NODE_ENV
) {
  if (nodeEnv !== "production") {
    return false;
  }

  const parsed = normalizeUrl(value);
  if (!parsed) {
    return false;
  }

  return isLocalHostname(parsed.hostname);
}

export function sanitizeInngestUrlEnv(env: MutableEnv = process.env, nodeEnv = process.env.NODE_ENV) {
  for (const key of INNGEST_LOCAL_URL_ENV_VARS) {
    const value = env[key];
    if (!shouldIgnoreInngestUrlOverride(value, nodeEnv)) {
      continue;
    }

    console.warn(
      `Ignoring ${key}=${value} in production because it points to a local address.`
    );
    delete env[key];
  }
}

export type { InngestUrlEnvVar };
