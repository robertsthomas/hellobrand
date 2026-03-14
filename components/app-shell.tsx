import Link from "next/link";
import type { ReactNode } from "react";

import type { Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppShell({
  viewer,
  children,
  currentPath
}: {
  viewer: Viewer;
  children: ReactNode;
  currentPath?: string;
}) {
  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/app/intake/new?pick=1", label: "Upload documents" }
  ];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="mb-10 flex flex-col gap-5 rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-white/5 px-6 py-5 shadow-panel backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="font-serif text-3xl text-ocean">
              HelloBrand
            </Link>
            <p className="mt-2 max-w-xl text-sm text-black/65 dark:text-white/70">
              Plain-English contract review and negotiation prep for creators.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:items-end">
            <nav className="flex flex-wrap gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    currentPath === item.href
                      ? "bg-ocean text-white"
                      : "bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/75 hover:bg-black/10"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="text-right text-sm text-black/60 dark:text-white/65">
              <div>{viewer.displayName}</div>
              <div>{viewer.email}</div>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
