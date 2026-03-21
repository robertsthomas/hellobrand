"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, CreditCard, UserRound, Mail } from "lucide-react";
import type { ReactNode } from "react";

const settingsTabs = [
  { href: "/app/settings", label: "General", icon: Settings, exact: true },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings/profile", label: "Profile", icon: UserRound },
  { href: "/app/settings/notifications", label: "Notifications", icon: Mail },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            Settings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your account, billing, and workflow preferences.
          </p>
        </div>

        <nav className="mb-8 flex gap-1 border-b border-black/[0.06]">
          {settingsTabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-foreground" />
                )}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
