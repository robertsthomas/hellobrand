import type { LucideIcon } from "lucide-react";

type HelpQuickLink = {
  icon: LucideIcon;
  label: string;
  description: string;
  accent: string;
};

export function HelpQuickLinks({ items }: { items: HelpQuickLink[] }) {
  return (
    <section className="grid gap-px overflow-hidden border border-black/8 bg-black/8 md:grid-cols-2 xl:grid-cols-4 dark:border-white/10 dark:bg-white/10">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white px-5 py-5 transition-colors hover:bg-secondary/30 dark:bg-card dark:hover:bg-white/[0.03]"
        >
          <item.icon className={`mb-3 h-5 w-5 ${item.accent}`} />
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
        </div>
      ))}
    </section>
  );
}
