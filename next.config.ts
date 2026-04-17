import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const shouldUploadSentryArtifacts =
  process.env.SENTRY_ENABLE_BUILD_UPLOADS === "true" && Boolean(process.env.SENTRY_AUTH_TOKEN);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  cacheComponents: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

const configuredNextConfig = withNextIntl(nextConfig);

export default shouldUploadSentryArtifacts
  ? withSentryConfig(configuredNextConfig, {
      org: process.env.SENTRY_ORG || "hello-brand",
      project: process.env.SENTRY_PROJECT || "javascript-nextjs",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      silent: !process.env.CI,
    })
  : configuredNextConfig;
