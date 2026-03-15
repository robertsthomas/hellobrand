import {
  SignInButton,
  SignUpButton,
  UserButton
} from "@clerk/nextjs";
import Link from "next/link";

import { Show } from "@/components/clerk-show";
import { ThemeSwitch } from "@/components/theme-switch";

export function MarketingNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-black/5 bg-[#eeece8]/95 backdrop-blur dark:border-white/10 dark:bg-[#171b1f]/90">
      <div className="mx-auto flex h-[76px] max-w-[1224px] items-center justify-between px-6 lg:px-8">
        <Show when="signed-out">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-[43px] w-[43px] items-center justify-center rounded-2xl bg-ocean text-[15px] font-semibold text-white">
              H
            </div>
            <span className="editorial-display text-[20px] font-semibold text-ocean dark:text-sand">
              HelloBrand
            </span>
          </Link>
        </Show>
        <Show when="signed-in">
          <Link href="/app" className="flex items-center gap-3">
            <div className="flex h-[43px] w-[43px] items-center justify-center rounded-2xl bg-ocean text-[15px] font-semibold text-white">
              H
            </div>
            <span className="editorial-display text-[20px] font-semibold text-ocean dark:text-sand">
              HelloBrand
            </span>
          </Link>
        </Show>
        <div className="flex items-center gap-3 md:hidden">
          <ThemeSwitch compact />
          <Show when="signed-out">
            <SignInButton>
              <button className="rounded-full bg-ocean px-4 py-2 text-sm font-medium text-white dark:bg-sand dark:text-[#18201d]">
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/app"
              className="rounded-full bg-ocean px-4 py-2 text-sm font-medium text-white dark:bg-sand dark:text-[#18201d]"
            >
              App
            </Link>
            <UserButton />
          </Show>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <ThemeSwitch compact />
          <div className="flex items-center gap-10 text-[15px] font-medium text-black/70 dark:text-white/70">
            <Link
              href="/pricing"
              className="transition hover:text-ocean dark:hover:text-sand"
            >
              Pricing
            </Link>
            <Link
              href="/waitlist"
              className="transition hover:text-ocean dark:hover:text-sand"
            >
              Waitlist
            </Link>
            <Link
              href="/app"
              className="transition hover:text-ocean dark:hover:text-sand"
            >
              App
            </Link>
            <Show when="signed-out">
              <div className="flex items-center gap-3">
                <SignInButton>
                  <button className="transition hover:text-ocean dark:hover:text-sand">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="rounded-full bg-ocean px-6 py-3 text-[15px] font-medium text-white shadow-[0_10px_25px_rgba(26,77,62,0.18)] dark:bg-sand dark:text-[#18201d] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
                    Get started
                  </button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-3">
                <Link
                  href="/app"
                  className="rounded-full bg-ocean px-6 py-3 text-[15px] font-medium text-white shadow-[0_10px_25px_rgba(26,77,62,0.18)] dark:bg-sand dark:text-[#18201d] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
                >
                  Open app
                </Link>
                <UserButton />
              </div>
            </Show>
          </div>
        </div>
      </div>
    </nav>
  );
}
