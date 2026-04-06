"use client";

import type { ReactNode } from "react";

export function InboxSelect({
  value,
  onChange,
  children,
  className = ""
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-9 w-full appearance-none border border-border bg-white px-3 pr-10 text-[12px] text-foreground outline-none transition focus:border-primary"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          backgroundImage: "none"
        }}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center border-l border-border/80">
        <span className="h-0 w-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-muted-foreground" />
      </div>
    </div>
  );
}
