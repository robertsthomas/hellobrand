import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton
} from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { Suspense, type ReactNode } from "react";

import "@/app/globals.css";
import { Show } from "@/components/clerk-show";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "HelloBrand",
  description: "Plain-English contract review for creators."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Suspense>
          <ClerkProvider
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
            <ThemeProvider>{children}</ThemeProvider>
          </ClerkProvider>
        </Suspense>
      </body>
    </html>
  );
}
