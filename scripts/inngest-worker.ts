import { createServer } from "node:http";
import { hostname } from "node:os";

import { ConnectionState, connect } from "inngest/connect";

import { inngestFunctions } from "@/lib/inngest/app";
import { inngest } from "@/lib/inngest/client";
import { waitForLaunchDarkly, isLaunchDarklyConfigured } from "@/lib/launchdarkly";

const DEFAULT_PORT = 8080;

function parsePort(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function parseConcurrency(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  console.log("[inngest-worker] starting", {
    appId: process.env.INNGEST_APP_ID || "hellobrand",
    inngestDev: process.env.INNGEST_DEV,
    nodeEnv: process.env.NODE_ENV,
    hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
    hasEventKey: !!process.env.INNGEST_EVENT_KEY,
  });

  if (isLaunchDarklyConfigured()) {
    await waitForLaunchDarkly();
  }

  const port = parsePort(process.env.PORT);
  const instanceId =
    process.env.INNGEST_WORKER_INSTANCE_ID?.trim() ||
    process.env.FLY_MACHINE_ID?.trim() ||
    hostname();
  const maxWorkerConcurrency = parseConcurrency(process.env.INNGEST_WORKER_MAX_CONCURRENCY);
  let connection: Awaited<ReturnType<typeof connect>> | null = null;

  const httpServer = createServer((req, res) => {
    if (req.url === "/ready") {
      const isReady = connection?.state === ConnectionState.ACTIVE;
      res.writeHead(isReady ? 200 : 503, { "Content-Type": "text/plain" });
      res.end(isReady ? "OK" : `NOT_READY:${connection?.state ?? "CONNECTING"}`);
      return;
    }

    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("NOT_FOUND");
  });

  httpServer.listen(port, "::", () => {
    console.log(`[inngest-worker] health server listening on [::]:${port}`);
  });

  try {
    connection = await connect({
      apps: [{ client: inngest, functions: inngestFunctions }],
      instanceId,
      maxWorkerConcurrency,
    });
  } catch (error) {
    console.error("[inngest-worker] connect failed", error);
    throw error;
  }

  console.log(
    `[inngest-worker] connected app=${inngest.id} state=${connection.state} instance=${instanceId}`
  );

  await connection.closed;
  console.log("[inngest-worker] connection closed");

  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

main().catch((error) => {
  console.error("[inngest-worker] fatal error", error);
  process.exit(1);
});
