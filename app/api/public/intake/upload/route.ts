/**
 * This route handles public event tracking and anonymous upload HTTP requests.
 * It keeps the public request boundary here and relies on the anonymous analysis modules for throttling, analysis, and claim behavior.
 */
import { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/http";
import {
  analyzeAnonymousUpload,
  countRecentAnonymousUploadAttempts,
  findReusableAnonymousAnalysisSession,
} from "@/lib/public-anonymous-analysis";
import { logPublicFunnelEvent } from "@/lib/public-funnel-events";
import {
  ANONYMOUS_UPLOAD_LIMIT_ERROR_CODE,
  ANONYMOUS_UPLOAD_MAX_COUNT,
  ANONYMOUS_VISITOR_COOKIE_MAX_AGE_SECONDS,
  ANONYMOUS_VISITOR_COOKIE_NAME,
  getAnonymousUploadSignInHref,
  getAnonymousUploadSignUpHref,
  hashBuffer,
  resolveAnonymousVisitorIdentity,
  validateAnonymousUploadFile,
} from "@/lib/public-upload-guards";
import { captureHandledError } from "@/lib/monitoring/sentry";
import {
  ANONYMOUS_CLAIM_TOKEN_COOKIE_MAX_AGE_SECONDS,
  ANONYMOUS_CLAIM_TOKEN_COOKIE_NAME,
} from "@/lib/public-upload-session";

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
    path: "/",
  });

  return response;
}

function attachClaimCookie(response: NextResponse, analysisToken: string) {
  response.cookies.set({
    name: ANONYMOUS_CLAIM_TOKEN_COOKIE_NAME,
    value: analysisToken,
    httpOnly: true,
    maxAge: ANONYMOUS_CLAIM_TOKEN_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/public/intake/claim",
  });

  return response;
}

export async function POST(request: NextRequest) {
  const identity = resolveAnonymousVisitorIdentity(request);

  await logPublicFunnelEvent("anonymous_upload_started", {
    path: "/api/public/intake/upload",
    visitorId: identity.visitorId,
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
      fileHash,
    });

    if (reusable) {
      await logPublicFunnelEvent("anonymous_upload_succeeded", {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        expiresAt: reusable.expiresAt,
        reused: true,
      });

      return attachClaimCookie(
        attachVisitorCookie(
          ok(
            {
              analysisToken: reusable.token,
              breakdown: reusable.breakdown,
              expiresAt: reusable.expiresAt,
            },
            { status: 200 }
          ),
          identity
        ),
        reusable.token
      );
    }

    const counts = await countRecentAnonymousUploadAttempts({
      visitorId: identity.visitorId,
      ipHash: identity.ipHash,
    });

    if (
      counts.visitorCount >= ANONYMOUS_UPLOAD_MAX_COUNT ||
      counts.ipCount >= ANONYMOUS_UPLOAD_MAX_COUNT
    ) {
      const message =
        "You’ve already used your free preview. Create a free workspace to keep going inside HelloBrand.";
      await logPublicFunnelEvent("anonymous_upload_failed", {
        message,
        code: ANONYMOUS_UPLOAD_LIMIT_ERROR_CODE,
        visitorCount: counts.visitorCount,
        ipCount: counts.ipCount,
      });

      return attachVisitorCookie(
        NextResponse.json(
          {
            error: message,
            code: ANONYMOUS_UPLOAD_LIMIT_ERROR_CODE,
            signUpHref: getAnonymousUploadSignUpHref(),
            signInHref: getAnonymousUploadSignInHref(),
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
      fileHash,
    });

    await logPublicFunnelEvent("anonymous_upload_succeeded", {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      expiresAt: result.expiresAt,
      reused: false,
    });

    return attachClaimCookie(
      attachVisitorCookie(
        ok(
          {
            analysisToken: result.token,
            breakdown: result.breakdown,
            expiresAt: result.expiresAt,
          },
          { status: 201 }
        ),
        identity
      ),
      result.token
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not analyze that document.";
    const isUserInputError =
      message.startsWith("Please ") ||
      message.includes("smaller than") ||
      message.includes("free uploads") ||
      message.includes("free preview");
    const status = isUserInputError ? 400 : 500;

    if (!isUserInputError) {
      captureHandledError(error, {
        area: "public_intake",
        name: "anonymous_upload",
        status,
        captureExpected: true,
        tags: {
          visitor: "anonymous",
        },
        extras: {
          visitorId: identity.visitorId,
        },
      });
    }

    await logPublicFunnelEvent("anonymous_upload_failed", {
      message,
    });

    return attachVisitorCookie(fail(message, status), identity);
  }
}
