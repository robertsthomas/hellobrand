import { NextRequest, NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/email/config";
import { handleGoogleCallbackForViewer } from "@/lib/email/service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const error = searchParams.get("error");
    if (error) {
      throw new Error(error);
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      throw new Error("Missing Google callback parameters.");
    }

    const viewer = await requireApiViewer();
    const redirectPath = await handleGoogleCallbackForViewer(viewer, { code, state });
    return NextResponse.redirect(`${getAppBaseUrl()}${redirectPath}`);
  } catch (error) {
    const params = new URLSearchParams({
      email_error: error instanceof Error ? error.message : "Google connection failed.",
      email_provider: "gmail"
    });
    return NextResponse.redirect(`${getAppBaseUrl()}/app/settings?${params.toString()}`);
  }
}
