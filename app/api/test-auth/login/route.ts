import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/http";
import {
  DEFAULT_E2E_VIEWER,
  isE2EAuthEnabled,
  setE2EViewerCookie
} from "@/lib/e2e-auth";

type LoginPayload = {
  secret?: string;
  userId?: string;
  email?: string;
  displayName?: string;
};

export async function POST(request: Request) {
  if (!isE2EAuthEnabled()) {
    return fail("Not found.", 404);
  }

  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return fail("Invalid request body.", 400);
  }

  if (payload.secret !== process.env.HELLOBRAND_E2E_AUTH_SECRET) {
    return fail("Invalid test auth secret.", 401);
  }

  const response = ok({
    viewer: {
      id: payload.userId?.trim() || DEFAULT_E2E_VIEWER.id,
      email: payload.email?.trim() || DEFAULT_E2E_VIEWER.email,
      displayName: payload.displayName?.trim() || DEFAULT_E2E_VIEWER.displayName
    }
  }) as NextResponse;

  setE2EViewerCookie(response, {
    id: payload.userId,
    email: payload.email,
    displayName: payload.displayName
  });

  return response;
}
