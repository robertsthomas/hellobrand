import Link from "next/link";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Show } from "@/components/clerk-show";
import { MarketingNav } from "@/components/marketing-nav";

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-16 sm:px-8 lg:px-10">
        <div className="w-full max-w-md border border-black/5 bg-white/85 p-8 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
          <h1 className="text-4xl font-semibold text-ink">Continue to HelloBrand</h1>
          <p className="mt-4 text-sm text-black/60 dark:text-white/65">
            Sign in or create an account to upload documents, confirm extracted
            contract data, and manage deal workspaces.
          </p>
          <div className="mt-8 grid gap-3">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="inline-flex justify-center rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white">
                  Create account
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="inline-flex justify-center rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink dark:border-white/12 dark:text-white">
                  Sign in
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center justify-between bg-sand/50 px-4 py-4 dark:bg-white/[0.04]">
                <span className="text-sm text-black/60 dark:text-white/65">
                  Signed in
                </span>
                <UserButton />
              </div>
              <Link
                href="/app"
                className="inline-flex justify-center rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white"
              >
                Open app
              </Link>
            </Show>
          </div>
        </div>
      </section>
    </div>
  );
}
