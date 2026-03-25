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
    pathname === "/favicon.ico" ||
    pathname === "/icon"
  );
}

function isMaintenanceBlockedPath(pathname: string) {
  return (
    pathname.startsWith("/app")
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

  if (!isMaintenanceBlockedPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/", request.url));
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
