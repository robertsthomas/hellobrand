import { IntakeSummaryCard } from "@/components/intake";

type IntakeSummaryCardItem = {
  label: string;
  value: string;
  loading?: boolean;
};

export function IntakeSummaryCards({
  cards,
}: {
  cards: IntakeSummaryCardItem[];
}) {
  return (
    <section className="-mx-4 border-y border-black/5 bg-white/85 px-4 py-6 dark:border-white/10 dark:bg-white/[0.06] sm:mx-0 sm:border sm:p-6 sm:shadow-panel">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <IntakeSummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            loading={card.loading}
          />
        ))}
      </div>
    </section>
  );
}
