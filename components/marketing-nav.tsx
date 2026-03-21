import { UserButton } from "@clerk/nextjs";
import { Hand } from "lucide-react";
import Link from "next/link";

import { Show } from "@/components/clerk-show";
import { ThemeSwitch } from "@/components/theme-switch";

export function MarketingNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-black/5 bg-[#fefcfa]/95 backdrop-blur dark:border-white/10 dark:bg-[#101318]/92">
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between px-5 sm:h-[72px] sm:px-6 lg:px-8">
        <Show when="signed-out">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
              <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
            </div>
            <span className="text-[1.625rem] font-bold tracking-[-0.05em] text-foreground">
              HelloBrand
            </span>
          </Link>
        </Show>
        <Show when="signed-in">
          <Link href="/app" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
              <Hand className="h-5 w-5 rotate-[18deg]" strokeWidth={2.15} />
            </div>
            <span className="text-[1.625rem] font-bold tracking-[-0.05em] text-foreground">
              HelloBrand
            </span>
          </Link>
        </Show>

        <div className="flex items-center gap-3 md:hidden">
          <ThemeSwitch compact />
          <Show when="signed-out">
            <Link
              href="/login?mode=sign-up"
              className="inline-flex h-10 items-center bg-primary px-4 text-sm font-medium text-white"
            >
              Get started
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/app"
              className="inline-flex h-10 items-center bg-primary px-4 text-sm font-medium text-white"
            >
              App
            </Link>
            <UserButton />
          </Show>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <ThemeSwitch compact />
          <div className="flex items-center gap-8 text-[14px] font-medium text-muted-foreground">
            <Link href="/pricing" className="transition hover:text-foreground">
              Pricing
            </Link>
            <Link href="/waitlist" className="transition hover:text-foreground">
              Waitlist
            </Link>
            <Link href="/app" className="transition hover:text-foreground">
              App
            </Link>
            <Show when="signed-out">
              <Link
                href="/login?mode=sign-up"
                className="inline-flex h-10 items-center bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
              >
                Get started
              </Link>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-3">
                <Link
                  href="/app"
                  className="inline-flex h-10 items-center bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/94 hover:shadow-md"
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
