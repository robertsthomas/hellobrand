const faqs = [
  {
    q: "What file types are supported?",
    a: "This beta supports text-based PDF, DOCX, pasted text, and basic plain-text notes like email threads or briefs."
  },
  {
    q: "Is this legal advice?",
    a: "No. HelloBrand helps creators understand contracts, but it is not a law firm."
  },
  {
    q: "Can HelloBrand send emails for me?",
    a: "Not in this version. It drafts polished copy you can copy into your usual inbox."
  },
  {
    q: "What kinds of documents can I add to a deal?",
    a: "Contracts, deliverables briefs, campaign briefs, decks, invoices, and pasted email context are all supported in the workspace flow."
  }
];

export default function HelpPage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-ink">Help</h1>
          <p className="mt-4 text-black/60 dark:text-white/65">
            Quick answers to the most common questions creators have while using
            HelloBrand.
          </p>
        </section>
        <div className="max-w-4xl space-y-4">
          {faqs.map((faq) => (
            <article
              key={faq.q}
              className="rounded-[1.5rem] border border-black/5 dark:border-white/10 bg-sand/60 dark:bg-white/[0.06] p-5"
            >
              <h2 className="text-2xl font-semibold text-ink">{faq.q}</h2>
              <p className="mt-3 text-sm text-black/60 dark:text-white/65">{faq.a}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
