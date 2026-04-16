/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { getAppBaseUrl, isProviderEnabled, resolveEmailAppBaseUrl } from "@/lib/email/config";
import { parseOAuthState } from "@/lib/email/oauth-state";
import { handleYahooCallbackForViewer } from "@/lib/email/service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callbackBaseUrl = resolveEmailAppBaseUrl(request.nextUrl.origin);

  try {
    const error = searchParams.get("error");
    if (error) {
      throw new Error(error);
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      throw new Error("Missing Yahoo callback parameters.");
    }

    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "email_connections");
    if (!(await isProviderEnabled("yahoo"))) {
      throw new Error("Yahoo email is not available.");
    }
    const redirectUrl = await handleYahooCallbackForViewer(viewer, { code, state });
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const state = searchParams.get("state");
    const returnBaseUrl = (() => {
      try {
        return resolveEmailAppBaseUrl(parseOAuthState(state).returnBaseUrl);
      } catch {
        return callbackBaseUrl || getAppBaseUrl();
      }
    })();
    const params = new URLSearchParams({
      email_error: error instanceof Error ? error.message : "Yahoo connection failed.",
      email_provider: "yahoo",
    });
    return NextResponse.redirect(`${returnBaseUrl}/app/settings?${params.toString()}`);
  }
}
