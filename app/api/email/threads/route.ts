import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { listInboxThreadsForViewer } from "@/lib/email/service";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const { searchParams } = new URL(request.url);
    const threads = await listInboxThreadsForViewer(viewer, {
      query: searchParams.get("q"),
      provider: searchParams.get("provider"),
      accountId: searchParams.get("accountId"),
      linkedDealId: searchParams.get("dealId"),
      linkedOnly: searchParams.get("linkedOnly") === "1",
      limit: Number(searchParams.get("limit") ?? 100)
    });

    return ok({ threads });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load email threads.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
