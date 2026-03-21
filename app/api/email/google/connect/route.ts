import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { createGoogleConnectUrlForViewer } from "@/lib/email/service";
import { getAppBaseUrl } from "@/lib/email/config";

export async function GET(_request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "email_connections");
    const url = await createGoogleConnectUrlForViewer(viewer);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const params = new URLSearchParams({
        redirect_url: `${getAppBaseUrl()}/app/settings`
      });
      return NextResponse.redirect(`${getAppBaseUrl()}/sign-in?${params.toString()}`);
    }

    const params = new URLSearchParams({
      email_error: error instanceof Error ? error.message : "Could not start Google connection.",
      email_provider: "gmail"
    });
    return NextResponse.redirect(`${getAppBaseUrl()}/app/settings?${params.toString()}`);
  }
}
