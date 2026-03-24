import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "border-dashed border-black/10 bg-white text-center shadow-panel dark:border-white/10",
        className,
      )}
    >
      <CardHeader className="px-8 pt-8">
        {icon ? (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            {icon}
          </div>
        ) : null}
        <CardTitle className="text-[34px] font-semibold tracking-[-0.05em]">
          {title}
        </CardTitle>
        <CardDescription className="mx-auto max-w-xl text-base leading-7">
          {description}
        </CardDescription>
      </CardHeader>
      {action ? (
        <CardContent className="flex justify-center pb-8">{action}</CardContent>
      ) : null}
    </Card>
  );
}
