export default function BillingPage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Billing</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Billing is intentionally deferred in the current beta, but this page
            is ready for Stripe plans, invoices, and usage limits once
            monetization starts.
          </p>
        </section>
        <section className="max-w-3xl rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] p-8 shadow-panel">
          <p className="text-sm text-black/60 dark:text-white/65">
            Plans, invoices, and usage limits will live here once the beta moves
            into paid subscriptions.
          </p>
        </section>
      </div>
    </div>
  );
}
