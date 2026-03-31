import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { connectYahooAccountForViewer } from "@/lib/email/service";

const yahooConnectSchema = z.object({
  emailAddress: z.string().trim().email("Enter a valid Yahoo email address."),
  appPassword: z.string().trim().min(1, "Enter your Yahoo app password.")
});

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/app/settings", request.nextUrl.origin);
  redirectUrl.searchParams.set(
    "email_error",
    "Yahoo now connects directly in Settings using your Yahoo email address and app password."
  );
  redirectUrl.searchParams.set("email_provider", "yahoo");
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "email_connections");
    const input = yahooConnectSchema.parse(await request.json());
    const account = await connectYahooAccountForViewer(viewer, input);

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
