import { NextResponse } from "next/server";

import { getIntegrationBaseUrl } from "@/lib/email/config";

export async function GET() {
  return NextResponse.redirect(
    `${getIntegrationBaseUrl()}/api/email/google/connect`
  );
}
