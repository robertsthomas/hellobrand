/**
 * This route handles Inngest callbacks and function execution requests.
 * It keeps the request boundary here while the workflow behavior itself stays in the Inngest and domain modules.
 */
import { serve } from "inngest/next";

import { inngestFunctions } from "@/lib/inngest/app";
import { inngest } from "@/lib/inngest/client";

export const maxDuration = 300;

const serveHandlers = serve({
  client: inngest,
  functions: inngestFunctions,
});

const inngestServeDisabled = process.env.INNGEST_SERVE_DISABLED === "1";

function disabledHandler() {
  return new Response("Inngest serve endpoint disabled.", { status: 404 });
}

export const GET = inngestServeDisabled ? disabledHandler : serveHandlers.GET;
export const POST = inngestServeDisabled ? disabledHandler : serveHandlers.POST;
export const PUT = inngestServeDisabled ? disabledHandler : serveHandlers.PUT;
