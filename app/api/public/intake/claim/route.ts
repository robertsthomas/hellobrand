/**
 * This route handles public event tracking and anonymous upload HTTP requests.
 * It keeps the public request boundary here and relies on the anonymous analysis modules for throttling, analysis, and claim behavior.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth";
import { ok } from "@/lib/http";
import { claimAnonymousAnalysisSession } from "@/lib/public-anonymous-analysis";
import { logPublicFunnelEvent } from "@/lib/public-funnel-events";
import {
  ANONYMOUS_CLAIM_TOKEN_COOKIE_NAME,
  ANONYMOUS_CLAIM_REDIRECT_PATH,
} from "@/lib/public-upload-session";

type ClaimFailurePayload = {
  title: string;
  error: string;
  code: string;
  href?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

function clearClaimCookie(response: NextResponse) {
  response.cookies.set({
    name: ANONYMOUS_CLAIM_TOKEN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/public/intake/claim",
  });

  return response;
}

function claimFailureResponse(
  payload: ClaimFailurePayload,
  status: number,
  clearCookie = true
) {
  const response = NextResponse.json(payload, { status });
  return clearCookie ? clearClaimCookie(response) : response;
}

function buildClaimFailurePayload(error: unknown): {
  status: number;
  payload: ClaimFailurePayload;
  clearCookie: boolean;
} {
  const message =
    error instanceof Error ? error.message : "Could not save this contract.";

  if (message === "Unauthorized") {
    return {
      status: 401,
      clearCookie: false,
      payload: {
        title: "Sign in to finish creating your free workspace.",
        error: "Your session ended before we could save the preview. Sign in again to continue.",
        code: "ANONYMOUS_CLAIM_UNAUTHORIZED",
        href: `/login?mode=sign-in&redirect=${encodeURIComponent(ANONYMOUS_CLAIM_REDIRECT_PATH)}`,
        ctaLabel: "Sign in",
      },
    };
  }

  if (message === "MISSING_ANONYMOUS_CLAIM_TOKEN") {
    return {
      status: 400,
      clearCookie: true,
      payload: {
        title: "We couldn’t find your free preview.",
        error: "Upload a contract again to create your free workspace.",
        code: "ANONYMOUS_CLAIM_TOKEN_MISSING",
        href: "/upload",
        ctaLabel: "Upload a contract",
      },
    };
  }

  if (
    message.includes("could not be found") ||
    message.includes("expired")
  ) {
    return {
      status: 400,
      clearCookie: true,
      payload: {
        title: "That free preview is no longer available.",
        error: "Upload the contract again to create your free workspace.",
        code: "ANONYMOUS_CLAIM_EXPIRED",
        href: "/upload",
        ctaLabel: "Upload again",
      },
    };
  }

  if (message === "This upload has already been claimed.") {
    return {
      status: 409,
      clearCookie: true,
      payload: {
        title: "That preview has already been claimed.",
        error: "Upload another contract to create a new free workspace.",
        code: "ANONYMOUS_CLAIM_ALREADY_CLAIMED",
        href: "/upload",
        ctaLabel: "Upload another contract",
        secondaryHref: "/app",
        secondaryLabel: "Go to app",
      },
    };
  }

  if (message === "This upload is already being saved. Please wait a moment.") {
    return {
      status: 409,
      clearCookie: false,
      payload: {
        title: "We’re still creating your free workspace.",
        error: message,
        code: "ANONYMOUS_CLAIM_IN_PROGRESS",
      },
    };
  }

  if (message.includes("The free plan supports") && message.includes("active workspaces")) {
    return {
      status: 409,
      clearCookie: true,
      payload: {
        title: "Your free workspace is already in use.",
        error: "Upgrade to Basic to save another deal, or return to your existing workspace.",
        code: "FREE_WORKSPACE_LIMIT_REACHED",
        href: "/app/settings/billing",
        ctaLabel: "Upgrade to Basic",
        secondaryHref: "/app",
        secondaryLabel: "Go to app",
      },
    };
  }

  if (message.includes("active workspaces")) {
    return {
      status: 409,
      clearCookie: true,
      payload: {
        title: "You’ve reached your workspace limit.",
        error: message,
        code: "WORKSPACE_LIMIT_REACHED",
        href: "/app/settings/billing",
        ctaLabel: "View billing",
        secondaryHref: "/app",
        secondaryLabel: "Go to app",
      },
    };
  }

  return {
    status: 400,
    clearCookie: true,
    payload: {
      title: "We couldn’t finish creating your free workspace.",
      error: message,
      code: "ANONYMOUS_CLAIM_FAILED",
      href: "/upload",
      ctaLabel: "Upload again",
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireApiViewer();
    const analysisToken =
      request.cookies.get(ANONYMOUS_CLAIM_TOKEN_COOKIE_NAME)?.value?.trim() ?? null;

    if (!analysisToken) {
      throw new Error("MISSING_ANONYMOUS_CLAIM_TOKEN");
    }

    const claimed = await claimAnonymousAnalysisSession(viewer, analysisToken);

    revalidateTag(`user-${viewer.id}-deals`, "max");
    revalidateTag(`deal-${claimed.dealId}`, "max");
    revalidatePath("/app", "layout");

    await logPublicFunnelEvent("anonymous_claim_succeeded", {
      viewerId: viewer.id,
      dealId: claimed.dealId,
      alreadyClaimed: claimed.alreadyClaimed
    });

    const response = ok({
      dealId: claimed.dealId,
      href: claimed.href,
      alreadyClaimed: claimed.alreadyClaimed
    });
    return clearClaimCookie(response);
  } catch (error) {
    const failure = buildClaimFailurePayload(error);

    await logPublicFunnelEvent("anonymous_claim_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      code: failure.payload.code
    });

    return claimFailureResponse(failure.payload, failure.status, failure.clearCookie);
  }
}
