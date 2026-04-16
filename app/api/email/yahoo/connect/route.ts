import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { resolveEmailAppBaseUrl } from "@/lib/email/config";
import {
  connectYahooAppPasswordForViewer,
  createYahooConnectUrlForViewerWithReturnBaseUrl,
} from "@/lib/email/service";
import { fail, ok } from "@/lib/http";

const yahooAppPasswordSchema = z.object({
  emailAddress: z.string().trim().email("Enter a valid Yahoo email address."),
  appPassword: z.string().trim().min(1, "Enter your Yahoo app password."),
});

export async function GET(request: NextRequest) {
  const requestBaseUrl = resolveEmailAppBaseUrl(request.nextUrl.origin);

  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "email_connections");
    const url = await createYahooConnectUrlForViewerWithReturnBaseUrl(
      viewer,
      requestBaseUrl
    );
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const params = new URLSearchParams({
        redirect_url: `${requestBaseUrl}/app/settings`
      });
      return NextResponse.redirect(`${requestBaseUrl}/sign-in?${params.toString()}`);
    }

    const params = new URLSearchParams({
      email_error: error instanceof Error ? error.message : "Could not start Yahoo connection.",
      email_provider: "yahoo"
    });
    return NextResponse.redirect(`${requestBaseUrl}/app/settings?${params.toString()}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "email_connections");
    const input = yahooAppPasswordSchema.parse(await request.json());
    const account = await connectYahooAppPasswordForViewer(viewer, input);

    return ok({
      accountId: account.id,
      emailAddress: account.emailAddress,
      status: account.status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect Yahoo Mail.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
