/**
 * This route handles admin-only HTTP requests.
 * It checks admin access here and then calls the shared admin modules that do the real work.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_SESSION_COOKIE_NAME,
  clearAdminSessionCookie,
  createAdminSession,
  createInitialAdminCredential,
  deleteAdminSessionByToken,
  getAdminUsername,
  isAdminConfigured,
  setAdminSessionCookie,
  verifyAdminPassword
} from "@/lib/admin-auth";
import { fail, ok } from "@/lib/http";

const sessionRequestSchema = z.object({
  mode: z.enum(["setup", "login"]),
  username: z.string().trim().min(1),
  password: z.string().min(8),
  confirmPassword: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const input = sessionRequestSchema.parse(await request.json());
    const configured = await isAdminConfigured();

    if (input.username.trim().toLowerCase() !== getAdminUsername()) {
      return fail("Only the admin username is allowed.", 400);
    }

    if (input.mode === "setup") {
      if (configured) {
        return fail("Admin credentials are already configured.", 400);
      }

      if (input.password !== input.confirmPassword) {
        return fail("Passwords do not match.", 400);
      }

      const credential = await createInitialAdminCredential(input.password);
      const { token } = await createAdminSession(credential.id);
      const response = ok({
        message: "Admin password created."
      });

      setAdminSessionCookie(response, token);
      return response;
    }

    if (!configured) {
      return fail("Admin credentials have not been configured yet.", 400);
    }

    const credential = await verifyAdminPassword(input.username, input.password);
    if (!credential) {
      return fail("Invalid username or password.", 401);
    }

    const { token } = await createAdminSession(credential.id);
    const response = ok({
      message: "Signed in."
    });

    setAdminSessionCookie(response, token);
    return response;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Could not sign in.";

    return fail(message, 400);
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  await deleteAdminSessionByToken(token);

  const response = NextResponse.json({
    message: "Signed out."
  });
  clearAdminSessionCookie(response);

  return response;
}
