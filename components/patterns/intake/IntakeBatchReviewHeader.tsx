import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function IntakeBatchReviewHeader() {
  return (
    <section className="space-y-4">
      <Link
        href="/app/intake/new"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to intake
      </Link>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
          Bulk intake
        </p>
        <h1 className="text-4xl font-semibold text-ink">
          Review detected partnerships
        </h1>
        <p className="text-[17px] leading-8 text-black/60 dark:text-white/65">
          We detected multiple partnerships in your uploaded documents. Review the
          groupings below, reassign documents if needed, then create each partnership.
        </p>
      </div>
    </section>
  );
}
