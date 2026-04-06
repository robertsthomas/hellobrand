import { LoaderCircle } from "lucide-react";

export function IntakeHelperText({
  analysisRunning,
  hasValue,
  emptyLabel,
  pendingLabel
}: {
  analysisRunning: boolean;
  hasValue: boolean;
  emptyLabel: string;
  pendingLabel: string;
}) {
  if (analysisRunning && !hasValue) {
    return (
      <span className="inline-flex min-h-[18px] items-center gap-2 text-xs font-normal text-black/50 dark:text-white/50">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        {pendingLabel}
      </span>
    );
  }

  return (
    <span className="inline-flex min-h-[18px] items-center text-xs font-normal text-black/50 dark:text-white/50">
      {emptyLabel}
    </span>
  );
}

export function IntakeHelperSpacer() {
  return <span aria-hidden="true" className="min-h-[18px]" />;
}
