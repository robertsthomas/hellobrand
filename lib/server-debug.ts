import { captureHandledError } from "@/lib/monitoring/sentry";

function shouldLogServerDebug() {
  return (
    process.env.DEBUG_SERVER_REQUESTS === "1" ||
    process.env.DEBUG_DOCUMENT_PIPELINE === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

function logServerDebug(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (!shouldLogServerDebug()) {
    return;
  }

  const logger = level === "error" ? console.error : console.info;
  logger(`[server-request] ${event}`, {
    at: new Date().toISOString(),
    ...details
  });
}

export function startServerDebug(
  event: string,
  details: Record<string, unknown>
) {
  const startedAt = Date.now();
  logServerDebug("info", `${event}_start`, details);

  return {
    complete(extra?: Record<string, unknown>) {
      logServerDebug("info", `${event}_complete`, {
        ...details,
        ...extra,
        durationMs: Date.now() - startedAt
      });
    },
    fail(error: unknown, extra?: Record<string, unknown>) {
      captureHandledError(error, {
        area: "server_action",
        name: event,
        captureExpected: true,
        extras: {
          ...details,
          ...extra,
          durationMs: Date.now() - startedAt
        }
      });
      logServerDebug("error", `${event}_failed`, {
        ...details,
        ...extra,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
}
