import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton
} from "@clerk/nextjs";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { Suspense, type ReactNode } from "react";

import "@/app/globals.css";
import { Show } from "@/components/clerk-show";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl, siteConfig } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "HelloBrand",
    template: "%s"
  },
  applicationName: siteConfig.name,
  description: siteConfig.description,
  keywords: [
    "creator contracts",
    "brand partnership management",
    "creator workflow",
    "deliverable tracking",
    "creator payments",
    "influencer contract review"
  ],
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: getSiteUrl()
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description
  }
};

async function AppProviders({ children }: { children: ReactNode }) {
  await cookies();

  return (
    <ClerkProvider
      waitlistUrl="/waitlist"
      appearance={{
        layout: {
          showOptionalFields: false
        }
      }}
    >
      <header className="sr-only">
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>
      <ThemeProvider>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Suspense>
          <AppProviders>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  );
}
