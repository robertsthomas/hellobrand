import { cn } from "@/lib/utils";

export function SummaryCard({
  label,
  value,
  caption,
  accent = "ocean"
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: "ocean" | "clay" | "sage";
}) {
  return (
    <div className="app-surface p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-5 text-4xl font-semibold tracking-tight",
          accent === "ocean" && "text-ocean",
          accent === "clay" && "text-clay",
          accent === "sage" && "text-sage"
        )}
      >
        {value}
      </p>
      {caption ? <p className="mt-6 text-sm text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
