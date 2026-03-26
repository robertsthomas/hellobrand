import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isMaintenanceModeEnabled() {
  return process.env.MAINTENANCE_MODE?.trim().toLowerCase() === "true";
}

function isMaintenanceAllowedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/privacy" ||
    pathname === "/waitlist" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/email/google/callback") ||
    pathname.startsWith("/api/email/outlook/callback") ||
    pathname.startsWith("/api/email/yahoo/callback") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon"
  );
}

export default clerkMiddleware((auth, request: NextRequest) => {
  if (!isMaintenanceModeEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isMaintenanceAllowedPath(pathname)) {
    return NextResponse.next();
  }

  // Block API routes with 503 during maintenance
  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }

  return NextResponse.redirect(new URL("/", request.url));
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
