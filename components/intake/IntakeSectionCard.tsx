import type { ReactNode } from "react";

const mobileSectionClassName =
  "-mx-4 border-y border-black/5 bg-white/85 px-4 py-6 dark:border-white/10 dark:bg-white/[0.06] sm:mx-0 sm:border sm:p-6 sm:shadow-panel";

export function IntakeSectionCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className={mobileSectionClassName}>
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="text-sm text-black/60 dark:text-white/65">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
