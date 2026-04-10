/**
 * This route handles local test-auth HTTP requests used by dev and E2E flows.
 * It exists so test-only authentication behavior stays separate from the real auth paths.
 */
import { NextResponse } from "next/server";

import { clearE2EViewerCookie, isE2EAuthEnabled } from "@/lib/e2e-auth";
import { fail, ok } from "@/lib/http";

export async function POST() {
  if (!isE2EAuthEnabled()) {
    return fail("Not found.", 404);
  }

  const response = ok({ ok: true }) as NextResponse;
  clearE2EViewerCookie(response);
  return response;
}
