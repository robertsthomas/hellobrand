/**
 * This route handles Documenso eSignature webhooks.
 * It verifies the shared secret, routes event types, and delegates to the documenso service.
 */

import { handleDocumensoWebhook } from "@/lib/documenso/service";
import type { DocumensoWebhookPayload } from "@/lib/documenso/types";
import { fail, ok } from "@/lib/http";

export async function POST(request: Request) {
  const secret = request.headers.get("x-documenso-secret");
  const expectedSecret = process.env.DOCUMENSO_WEBHOOK_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return fail("Invalid webhook secret.", 401);
  }

  let body: DocumensoWebhookPayload;
  try {
    body = (await request.json()) as DocumensoWebhookPayload;
  } catch {
    return fail("Invalid JSON payload.", 400);
  }

  if (!body.event || !body.payload) {
    return fail("Missing event or payload.", 400);
  }

  try {
    await handleDocumensoWebhook(body);
    return ok({ received: true });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Documenso webhook processing failed.",
      500,
      {
        error,
        area: "documenso",
        name: "documenso_webhook_process",
        tags: { eventType: body.event },
        extras: { envelopeId: body.payload.id },
      }
    );
  }
}
