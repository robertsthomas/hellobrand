"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const isLocalAppUrl =
  appUrl.startsWith("http://localhost") ||
  appUrl.startsWith("http://127.0.0.1");
const isSentryEnabled =
  process.env.NODE_ENV !== "development" &&
  !isLocalAppUrl &&
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT !== "development" &&
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT !== "dev" &&
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "development";

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (!isSentryEnabled) {
      return;
    }

    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={500} />
      </body>
    </html>
  );
}
