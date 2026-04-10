/**
 * This route handles inbox and email HTTP requests.
 * It connects the request to the email domain modules for accounts, threads, attachments, provider callbacks, and workflow actions.
 */
import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { assertViewerHasFeature } from "@/lib/billing/entitlements";
import { fail, ok } from "@/lib/http";
import { disconnectEmailAccountForViewer } from "@/lib/email/service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const viewer = await requireApiViewer();
    await assertViewerHasFeature(viewer, "email_connections");
    const { accountId } = await params;
    const account = await disconnectEmailAccountForViewer(viewer, accountId);

    if (!account) {
      return fail("Email account not found.", 404);
    }

    return ok({
      account: {
        id: account.id,
        provider: account.provider,
        emailAddress: account.emailAddress,
        status: account.status,
        lastSyncAt: account.lastSyncAt
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not disconnect email account.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
