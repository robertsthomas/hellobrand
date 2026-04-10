/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { resolveEmailAppBaseUrl } from "@/lib/email/config";
import { createYahooConnectUrlForViewerWithReturnBaseUrl } from "@/lib/email/service";

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
