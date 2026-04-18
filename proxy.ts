import createMiddleware from "next-intl/middleware";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { maintenanceMode } from "./flags";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);
const localeAlternation = routing.locales.join("|");
const intlRoutePattern = /^\/(?:pricing|upload|sample|blog|privacy)(?:\/.*)?$/;
const appRoutePattern = /^\/app(?:\/.*)?$/;
const localeRoutePattern = new RegExp(`^\\/(?:${localeAlternation})(?:\\/.*)?$`);
const localeRootPattern = new RegExp(`^\\/(?:${localeAlternation})$`);
const localizedAppRoutePattern = new RegExp(`^\\/((?:${localeAlternation}))\\/app(?:\\/(.*))?$`);

async function isMaintenanceModeEnabled() {
  return (await maintenanceMode()) === true;
}

function shouldHandleI18n(pathname: string) {
  return (
    pathname === "/" ||
    intlRoutePattern.test(pathname) ||
    appRoutePattern.test(pathname) ||
    localeRoutePattern.test(pathname)
  );
}

function getLocalizedAppRewrite(pathname: string) {
  const match = pathname.match(localizedAppRoutePattern);
  if (!match) {
    return null;
  }

  const [, locale, remainder] = match;

  return {
    locale,
    pathname: remainder ? `/app/${remainder}` : "/app",
  };
}

function getPreferredLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && routing.locales.some((locale) => locale === cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) {
    return routing.defaultLocale;
  }

  const requestedLocales = acceptLanguage
    .split(",")
    .map((entry) => entry.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  for (const requestedLocale of requestedLocales) {
    const exactMatch = routing.locales.find((locale) => locale.toLowerCase() === requestedLocale);
    if (exactMatch) {
      return exactMatch;
    }

    const baseLocale = requestedLocale.split("-")[0];
    const partialMatch = routing.locales.find((locale) => locale.toLowerCase() === baseLocale);
    if (partialMatch) {
      return partialMatch;
    }
  }

  return routing.defaultLocale;
}

function isMaintenanceAllowedPath(pathname: string) {
  return (
    pathname === "/" ||
    localeRootPattern.test(pathname) ||
    pathname.startsWith("/admin") ||
    pathname === "/privacy" ||
    pathname === "/waitlist" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/inngest") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/email/google/callback") ||
    pathname.startsWith("/api/email/outlook/callback") ||
    pathname.startsWith("/api/email/yahoo/callback") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon"
  );
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if ((await isMaintenanceModeEnabled()) && !isMaintenanceAllowedPath(pathname)) {
    // Block API routes with 503 during maintenance
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  if (appRoutePattern.test(pathname)) {
    const locale = getPreferredLocale(request);

    if (locale !== routing.defaultLocale) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${locale}${pathname}`;
      return NextResponse.redirect(redirectUrl);
    }

    const headers = new Headers(request.headers);
    headers.set("X-NEXT-INTL-LOCALE", locale);

    const response = NextResponse.next({
      request: {
        headers,
      },
    });

    response.cookies.set("NEXT_LOCALE", locale, {
      sameSite: "lax",
    });

    return response;
  }

  if (shouldHandleI18n(pathname)) {
    const localizedAppRewrite = getLocalizedAppRewrite(pathname);

    if (localizedAppRewrite) {
      const headers = new Headers(request.headers);
      headers.set("X-NEXT-INTL-LOCALE", localizedAppRewrite.locale);

      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = localizedAppRewrite.pathname;

      const response = NextResponse.rewrite(rewriteUrl, {
        request: {
          headers,
        },
      });

      response.cookies.set("NEXT_LOCALE", localizedAppRewrite.locale, {
        sameSite: "lax",
      });

      return response;
    }

    return handleI18nRouting(request);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
