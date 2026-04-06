import { LoaderCircle } from "lucide-react";

export function IntakeSummaryCard({
  label,
  value,
  loading
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-sand/55 px-4 py-4 dark:bg-white/[0.04]">
      <div className="text-xs uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-ink">
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-ocean" /> : null}
        <span>{value}</span>
      </div>
    </div>
  );
}
