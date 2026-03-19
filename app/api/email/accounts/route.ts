import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { listEmailAccountsForViewer } from "@/lib/email/service";

function sanitizeAccount(account: Awaited<ReturnType<typeof listEmailAccountsForViewer>>[number]) {
  return {
    id: account.id,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    emailAddress: account.emailAddress,
    displayName: account.displayName,
    status: account.status,
    scopes: account.scopes,
    tokenExpiresAt: account.tokenExpiresAt,
    lastSyncAt: account.lastSyncAt,
    lastErrorCode: account.lastErrorCode,
    lastErrorMessage: account.lastErrorMessage,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

export async function GET(_request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const accounts = await listEmailAccountsForViewer(viewer);
    return ok({ accounts: accounts.map(sanitizeAccount) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}
