import Link from "next/link";

import { Button } from "@/components/ui/button";

export function RuntimeStatusPage({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#f6f3ee] px-6 py-12 text-[#1f1a14]">
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-3xl items-center">
        <div className="w-full rounded-[2rem] border border-black/5 bg-white px-8 py-10 shadow-sm sm:px-12 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-[16ch] text-4xl font-semibold tracking-[-0.04em] text-[#1f1a14] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-[48ch] text-base leading-7 text-[#5d5348]">
            {description}
          </p>
          {actionHref && actionLabel ? (
            <Button asChild className="mt-8">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
