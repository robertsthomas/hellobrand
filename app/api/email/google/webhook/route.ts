/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest } from "next/server";

import { ok } from "@/lib/http";
import { decodeBase64Url } from "@/lib/email/crypto";
import { handleGmailWebhookNotification } from "@/lib/email/service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: {
      data?: string;
    };
  };

  const encoded = body.message?.data;
  if (!encoded) {
    return ok({ received: true });
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encoded).toString("utf8")) as {
      emailAddress?: string;
      historyId?: string;
    };

    if (payload.emailAddress && payload.historyId) {
      await handleGmailWebhookNotification({
        emailAddress: payload.emailAddress,
        historyId: payload.historyId
      });
    }
  } catch {
    // Always ack Pub/Sub deliveries.
  }

  return ok({ received: true });
}
