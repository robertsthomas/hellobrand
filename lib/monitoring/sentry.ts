import * as Sentry from "@sentry/nextjs";

type MonitoringDetails = Record<string, unknown>;

type MonitoringContext = {
  area: string;
  name: string;
  status?: number;
  viewerId?: string | null;
  captureExpected?: boolean;
  level?: "error" | "warning" | "info";
  tags?: Record<string, string | number | boolean | null | undefined>;
  extras?: MonitoringDetails;
  fingerprint?: string[];
};

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string" && error.trim()) {
    return new Error(error);
  }

  return new Error("Unexpected error");
}

function isExpectedStatus(status: number | undefined) {
  return typeof status === "number" && status >= 400 && status < 500;
}

export function captureHandledError(error: unknown, context: MonitoringContext) {
  if (!context.captureExpected && isExpectedStatus(context.status)) {
    return;
  }

  const normalizedError = toError(error);

  Sentry.withScope((scope) => {
    scope.setLevel(
      context.level ?? (isExpectedStatus(context.status) ? "warning" : "error")
    );
    scope.setTag("monitoring.area", context.area);
    scope.setTag("monitoring.name", context.name);

    if (typeof context.status === "number") {
      scope.setTag("http.status_code", String(context.status));
    }

    if (context.viewerId) {
      scope.setUser({ id: context.viewerId });
    }

    for (const [key, value] of Object.entries(context.tags ?? {})) {
      if (value === null || value === undefined) {
        continue;
      }

      scope.setTag(key, String(value));
    }

    if (context.extras && Object.keys(context.extras).length > 0) {
      scope.setContext("details", context.extras);
    }

    if (context.fingerprint?.length) {
      scope.setFingerprint(context.fingerprint);
    }

    Sentry.captureException(normalizedError);
  });
}
