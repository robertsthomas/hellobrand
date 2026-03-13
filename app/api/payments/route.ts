import { NextRequest } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { listPaymentsForViewer, updatePaymentForViewer } from "@/lib/payments";
import { paymentRecordInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const payments = await listPaymentsForViewer(viewer);
    return ok({ payments });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unauthorized", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const body = await request.json();
    const dealId = String(body.dealId ?? "");
    const input = paymentRecordInputSchema.parse(body);
    const payment = await updatePaymentForViewer(viewer, dealId, input);

    if (!payment) {
      return fail("Deal not found.", 404);
    }

    return ok({ payment });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update payment.";
    return fail(message, message === "Unauthorized" ? 401 : 400);
  }
}
