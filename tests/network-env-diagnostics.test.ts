import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectProxyEnvDiagnostics,
  describeUrlEnvOverride,
  logOutboundNetworkDiagnostics,
  resetLoggedNetworkDiagnosticsForTests,
  shouldLogNetworkDiagnostics,
} from "@/lib/network/env-diagnostics";

afterEach(() => {
  resetLoggedNetworkDiagnosticsForTests();
  vi.restoreAllMocks();
});

describe("describeUrlEnvOverride", () => {
  it("reports local hostnames without returning raw values", () => {
    expect(describeUrlEnvOverride("http://127.0.0.1:8288")).toEqual({
      present: true,
      hostname: "127.0.0.1",
      isLocal: true,
      parseFailed: false,
    });
  });

  it("marks invalid URLs as parse failures", () => {
    expect(describeUrlEnvOverride("not-a-url")).toEqual({
      present: true,
      hostname: null,
      isLocal: false,
      parseFailed: true,
    });
  });
});

describe("collectProxyEnvDiagnostics", () => {
  it("captures proxy presence and localhost state", () => {
    expect(
      collectProxyEnvDiagnostics({
        HTTP_PROXY: "http://localhost:8288",
        HTTPS_PROXY: "https://proxy.example.com",
        ALL_PROXY: undefined,
        NO_PROXY: "localhost,127.0.0.1",
        NODE_USE_ENV_PROXY: "1",
      })
    ).toEqual({
      HTTP_PROXY: {
        present: true,
        hostname: "localhost",
        isLocal: true,
        parseFailed: false,
      },
      HTTPS_PROXY: {
        present: true,
        hostname: "proxy.example.com",
        isLocal: false,
        parseFailed: false,
      },
      ALL_PROXY: {
        present: false,
        hostname: null,
        isLocal: false,
        parseFailed: false,
      },
      NO_PROXY: {
        present: true,
      },
      NODE_USE_ENV_PROXY: {
        present: true,
        enabled: true,
      },
    });
  });
});

describe("logOutboundNetworkDiagnostics", () => {
  it("logs only once per service in Vercel preview", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const env = {
      RESEND_BASE_URL: undefined,
      HTTP_PROXY: undefined,
      HTTPS_PROXY: undefined,
      ALL_PROXY: undefined,
      NO_PROXY: undefined,
      NODE_USE_ENV_PROXY: undefined,
    };

    logOutboundNetworkDiagnostics({
      service: "resend",
      urlEnvVars: ["RESEND_BASE_URL"],
      effectiveHosts: { api: "api.resend.com" },
      env,
      nodeEnv: "development",
      vercelEnv: "preview",
    });
    logOutboundNetworkDiagnostics({
      service: "resend",
      urlEnvVars: ["RESEND_BASE_URL"],
      effectiveHosts: { api: "api.resend.com" },
      env,
      nodeEnv: "development",
      vercelEnv: "preview",
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toBe("[network-diagnostics]");
    expect(infoSpy.mock.calls[0]?.[1]).toMatchObject({
      service: "resend",
      nodeEnv: "development",
      vercelEnv: "preview",
      effectiveHosts: { api: "api.resend.com" },
    });
  });
});

describe("shouldLogNetworkDiagnostics", () => {
  it("logs for Vercel preview", () => {
    expect(shouldLogNetworkDiagnostics("development", "preview")).toBe(true);
  });

  it("logs for production outside Vercel", () => {
    expect(shouldLogNetworkDiagnostics("production", undefined)).toBe(true);
  });

  it("does not log for local development", () => {
    expect(shouldLogNetworkDiagnostics("development", undefined)).toBe(false);
  });
});
