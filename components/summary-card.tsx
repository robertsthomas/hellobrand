import { cn } from "@/lib/utils";

export function SummaryCard({
  label,
  value,
  caption,
  accent = "ocean",
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: "ocean" | "clay" | "sage";
}) {
  return (
    <div className="app-surface gap-0 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-4 text-[34px] font-semibold tracking-[-0.05em]",
          accent === "ocean" && "text-ocean",
          accent === "clay" && "text-clay",
          accent === "sage" && "text-sage"
        )}
      >
        {value}
      </p>
      {caption ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
