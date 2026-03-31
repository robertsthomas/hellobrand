import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/app/settings", request.nextUrl.origin);
  redirectUrl.searchParams.set(
    "email_error",
    "Yahoo mailbox access is configured directly in Settings with your Yahoo app password."
  );
  redirectUrl.searchParams.set("email_provider", "yahoo");
  return NextResponse.redirect(redirectUrl);
}
