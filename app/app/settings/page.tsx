export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Settings</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Set your default preferences for currency, reminders, and future deal
            workflow behavior.
          </p>
        </section>
        <section className="max-w-4xl rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] p-8 shadow-panel">
          <div className="grid gap-6 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Default currency
              <input
                className="rounded-[1.25rem] border-black/10 dark:border-white/12 bg-sand/50 dark:bg-white/[0.05] px-4 py-4"
                defaultValue="USD"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/70 dark:text-white/75">
              Reminder cadence
              <input
                className="rounded-[1.25rem] border-black/10 dark:border-white/12 bg-sand/50 dark:bg-white/[0.05] px-4 py-4"
                defaultValue="3 days before due date"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
