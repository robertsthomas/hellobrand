import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense, type ReactNode } from "react";

import "@/app/globals.css";
import { PostHogProvider } from "@/app/providers";
import { AuthProvider } from "@/components/auth-provider";
import { HtmlLangSync } from "@/components/html-lang-sync";
import { PostHogPageView } from "@/components/posthog-pageview";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl, siteConfig } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Brand Deal Contract Review for Creators | HelloBrand",
    template: "%s | HelloBrand",
  },
  applicationName: siteConfig.name,
  description: siteConfig.description,
  keywords: [
    "creator contracts",
    "brand partnership management",
    "creator workflow",
    "deliverable tracking",
    "creator payments",
    "influencer contract review",
  ],
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: getSiteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121518" },
  ],
};

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PostHogProvider>
        <ThemeProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </PostHogProvider>
    </AuthProvider>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${inter.variable} min-h-dvh bg-background`}>
        <Suspense fallback={null}>
          <HtmlLangSync />
        </Suspense>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Suspense>
          <div id="main-content">
            <AppProviders>{children}</AppProviders>
          </div>
        </Suspense>
      </body>
    </html>
  );
}
