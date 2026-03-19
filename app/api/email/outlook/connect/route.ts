import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/email/config";
import { createOutlookConnectUrlForViewer } from "@/lib/email/service";

export async function GET(_request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const url = await createOutlookConnectUrlForViewer(viewer);
    return NextResponse.redirect(url);
  } catch (error) {
    const params = new URLSearchParams({
      email_error: error instanceof Error ? error.message : "Could not start Outlook connection.",
      email_provider: "outlook"
    });
    return NextResponse.redirect(`${getAppBaseUrl()}/app/settings?${params.toString()}`);
  }
}
