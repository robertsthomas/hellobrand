/**
 * This file exposes the Inngest serve endpoint for local development and serverless runtimes.
 * The dedicated worker uses Inngest connect separately, so this route can be disabled by env.
 */
import { serve } from "inngest/next";

import { inngestFunctions } from "@/lib/inngest/app";
import { inngest } from "@/lib/inngest/client";

const disabledResponse = () =>
  new Response("Inngest serve endpoint disabled", {
    status: 404,
    headers: {
      "content-type": "text/plain",
    },
  });

const handler = serve({
  client: inngest,
  functions: inngestFunctions,
  servePath: "/api/inngest",
});

export const GET = process.env.INNGEST_SERVE_DISABLED === "1" ? disabledResponse : handler.GET;
export const POST = process.env.INNGEST_SERVE_DISABLED === "1" ? disabledResponse : handler.POST;
export const PUT = process.env.INNGEST_SERVE_DISABLED === "1" ? disabledResponse : handler.PUT;
