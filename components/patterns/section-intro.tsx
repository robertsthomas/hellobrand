import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionIntro({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleClassName,
  descriptionClassName,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "text-2xl font-semibold tracking-[-0.04em] text-foreground",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("text-sm leading-6 text-muted-foreground", descriptionClassName)}>
          {description}
        </p>
      ) : null}
      {actions ? <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div> : null}
    </div>
  );
}
