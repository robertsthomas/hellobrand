/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextResponse } from "next/server";

import { getIntegrationBaseUrl } from "@/lib/email/config";

export async function GET() {
  return NextResponse.redirect(
    `${getIntegrationBaseUrl()}/api/email/google/connect`
  );
}
