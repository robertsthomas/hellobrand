/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextResponse } from "next/server";

import { isProviderEnabled } from "@/lib/email/config";
import { getIntegrationBaseUrl } from "@/lib/email/config";

export async function GET() {
  if (!(await isProviderEnabled("gmail"))) {
    return NextResponse.redirect(
      `${getIntegrationBaseUrl()}/app/settings?email_error=Google+Gmail+is+not+available&email_provider=gmail`
    );
  }

  return NextResponse.redirect(`${getIntegrationBaseUrl()}/api/email/google/connect`);
}
