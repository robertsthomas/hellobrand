/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest, NextResponse } from "next/server";

import { getMicrosoftWebhookClientState } from "@/lib/email/config";
import { handleOutlookWebhookNotifications } from "@/lib/email/service";

function validationResponse(token: string) {
  return new NextResponse(token, {
    headers: {
      "content-type": "text/plain"
    }
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get("validationToken");

  if (validationToken) {
    return validationResponse(validationToken);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get("validationToken");
  if (validationToken) {
    return validationResponse(validationToken);
  }

  const body = (await request.json().catch(() => ({ value: [] }))) as {
    value?: Array<{
      subscriptionId?: string;
      resource?: string;
      clientState?: string;
      resourceData?: { id?: string };
    }>;
  };

  const expectedClientState = getMicrosoftWebhookClientState();
  const notifications = (body.value ?? []).filter((entry) =>
    expectedClientState ? entry.clientState === expectedClientState : true
  );

  await handleOutlookWebhookNotifications(notifications);
  return NextResponse.json({ received: true });
}
