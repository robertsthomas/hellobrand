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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "HelloBrand",
  description: "Plain-English contract review for creators."
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
