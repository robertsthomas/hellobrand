import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { createDealForViewer, listDealsForViewer } from "@/lib/deals";
import { fail, ok } from "@/lib/http";
import { createDealSchema } from "@/lib/validation";

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const deals = await listDealsForViewer(viewer);
    return ok({ deals });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const body = await request.json();
    const input = createDealSchema.parse(body);
    const deal = await createDealForViewer(viewer, input);
    return ok({ deal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create deal.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
