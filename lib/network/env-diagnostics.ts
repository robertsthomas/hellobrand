const PROXY_ENV_VARS = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"] as const;

type MutableEnv = Record<string, string | undefined>;
type DiagnosticLogInput = {
  service: string;
  urlEnvVars: readonly string[];
  effectiveHosts: Record<string, string | null>;
  extras?: Record<string, unknown>;
  env?: MutableEnv;
  nodeEnv?: string | undefined;
  vercelEnv?: string | undefined;
};

const loggedServices = new Set<string>();

export function shouldLogNetworkDiagnostics(
  nodeEnv = process.env.NODE_ENV,
  vercelEnv = process.env.VERCEL_ENV
) {
  if (vercelEnv === "production" || vercelEnv === "preview") {
    return true;
  }

  return nodeEnv === "production";
}

export function normalizeUrl(value: string | null | undefined) {
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

export function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

export function describeUrlEnvOverride(value: string | null | undefined) {
  const present = typeof value === "string" && value.trim().length > 0;
  const parsed = normalizeUrl(value);

  return {
    present,
    hostname: parsed?.hostname ?? null,
    isLocal: parsed ? isLocalHostname(parsed.hostname) : false,
    parseFailed: present && !parsed,
  };
}

export function describeNodeUseEnvProxy(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return {
    present: normalized.length > 0,
    enabled: ["1", "true", "yes", "on"].includes(normalized),
  };
}

export function collectProxyEnvDiagnostics(env: MutableEnv = process.env) {
  return {
    HTTP_PROXY: describeUrlEnvOverride(env.HTTP_PROXY),
    HTTPS_PROXY: describeUrlEnvOverride(env.HTTPS_PROXY),
    ALL_PROXY: describeUrlEnvOverride(env.ALL_PROXY),
    NO_PROXY: {
      present: typeof env.NO_PROXY === "string" && env.NO_PROXY.trim().length > 0,
    },
    NODE_USE_ENV_PROXY: describeNodeUseEnvProxy(env.NODE_USE_ENV_PROXY),
  };
}

export function logOutboundNetworkDiagnostics(input: DiagnosticLogInput) {
  const env = input.env ?? process.env;
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  const vercelEnv = input.vercelEnv ?? process.env.VERCEL_ENV;

  if (!shouldLogNetworkDiagnostics(nodeEnv, vercelEnv) || loggedServices.has(input.service)) {
    return;
  }

  loggedServices.add(input.service);

  const urlEnv = Object.fromEntries(
    input.urlEnvVars.map((key) => [key, describeUrlEnvOverride(env[key])])
  );

  console.info("[network-diagnostics]", {
    service: input.service,
    nodeEnv,
    vercelEnv: vercelEnv ?? null,
    effectiveHosts: input.effectiveHosts,
    urlEnv,
    proxyEnv: collectProxyEnvDiagnostics(env),
    extras: input.extras ?? {},
  });
}

export function resetLoggedNetworkDiagnosticsForTests() {
  loggedServices.clear();
}

export { PROXY_ENV_VARS };
