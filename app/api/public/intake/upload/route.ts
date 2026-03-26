import { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/http";
import {
  analyzeAnonymousUpload,
  countRecentAnonymousUploadAttempts,
  findReusableAnonymousAnalysisSession,
  recordAnonymousUploadAttempt
} from "@/lib/public-anonymous-analysis";
import { logPublicFunnelEvent } from "@/lib/public-funnel-events";
import {
  ANONYMOUS_UPLOAD_LIMIT_ERROR_CODE,
  ANONYMOUS_UPLOAD_MAX_COUNT,
  ANONYMOUS_VISITOR_COOKIE_MAX_AGE_SECONDS,
  ANONYMOUS_VISITOR_COOKIE_NAME,
  getAnonymousUploadSignUpHref,
  hashBuffer,
  resolveAnonymousVisitorIdentity,
  validateAnonymousUploadFile
} from "@/lib/public-upload-guards";

function attachVisitorCookie(
  response: NextResponse,
  identity: ReturnType<typeof resolveAnonymousVisitorIdentity>
) {
  if (!identity.shouldSetVisitorCookie) {
    return response;
  }

  response.cookies.set({
    name: ANONYMOUS_VISITOR_COOKIE_NAME,
    value: identity.visitorId,
    httpOnly: true,
    maxAge: ANONYMOUS_VISITOR_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}

export async function POST(request: NextRequest) {
  const identity = resolveAnonymousVisitorIdentity(request);

  await logPublicFunnelEvent("anonymous_upload_started", {
    path: "/api/public/intake/upload",
    visitorId: identity.visitorId
  });

  try {
    const formData = await request.formData();
    const file = formData
      .getAll("document")
      .find((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!file) {
      throw new Error("Please choose a document file to analyze.");
    }

    validateAnonymousUploadFile(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = hashBuffer(bytes);
    const reusable = await findReusableAnonymousAnalysisSession({
      visitorId: identity.visitorId,
      fileHash
    });

    if (reusable) {
      await logPublicFunnelEvent("anonymous_upload_succeeded", {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        expiresAt: reusable.expiresAt,
        reused: true
      });

      return attachVisitorCookie(
        ok(
          {
            analysisToken: reusable.token,
            breakdown: reusable.breakdown,
            expiresAt: reusable.expiresAt
          },
          { status: 200 }
        ),
        identity
      );
    }

    const counts = await countRecentAnonymousUploadAttempts({
      visitorId: identity.visitorId,
      ipHash: identity.ipHash
    });

    if (
      counts.visitorCount >= ANONYMOUS_UPLOAD_MAX_COUNT ||
      counts.ipCount >= ANONYMOUS_UPLOAD_MAX_COUNT
    ) {
      const message =
        "You’ve used all 3 free anonymous uploads. Create an account to continue inside HelloBrand.";
      await logPublicFunnelEvent("anonymous_upload_failed", {
        message,
        code: ANONYMOUS_UPLOAD_LIMIT_ERROR_CODE,
        visitorCount: counts.visitorCount,
        ipCount: counts.ipCount
      });

      return attachVisitorCookie(
        NextResponse.json(
          {
            error: message,
            code: ANONYMOUS_UPLOAD_LIMIT_ERROR_CODE,
            redirectTo: getAnonymousUploadSignUpHref()
          },
          { status: 429 }
        ),
        identity
      );
    }

    const result = await analyzeAnonymousUpload({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
      visitorId: identity.visitorId,
      ipHash: identity.ipHash,
      fileHash
    });

    await recordAnonymousUploadAttempt({
      visitorId: identity.visitorId,
      ipHash: identity.ipHash,
      fileHash
    });

    await logPublicFunnelEvent("anonymous_upload_succeeded", {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      expiresAt: result.expiresAt,
      reused: false
    });

    return attachVisitorCookie(
      ok(
        {
          analysisToken: result.token,
          breakdown: result.breakdown,
          expiresAt: result.expiresAt
        },
        { status: 201 }
      ),
      identity
    );
  } catch (error) {
    await logPublicFunnelEvent("anonymous_upload_failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });

    return attachVisitorCookie(
      fail(
        error instanceof Error ? error.message : "Could not analyze that document.",
        400
      ),
      identity
    );
  }
}
