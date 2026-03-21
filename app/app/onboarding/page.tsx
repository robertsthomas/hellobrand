import Link from "next/link";
import { Check, FileText, Sparkles, Upload } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Upload your first partnership docs",
    body: "Drop in a contract, brief, deck, or pasted email context so HelloBrand can build the workspace.",
    icon: Upload,
    tint: "bg-ocean/10 text-ocean"
  },
  {
    number: 2,
    title: "Review the summary",
    body: "Get a plain-English explanation of payment, deliverables, rights, and timing.",
    icon: FileText,
    tint: "bg-clay/10 text-clay"
  },
  {
    number: 3,
    title: "Take action",
    body: "Use creator-friendly email drafts to negotiate or follow up professionally.",
    icon: Check,
    tint: "bg-sage/10 text-sage"
  }
];

export default function OnboardingPage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="max-w-3xl text-center mx-auto">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ocean/10 text-ocean">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-4xl font-semibold text-ink">
            Welcome to HelloBrand
          </h1>
          <p className="mt-4 text-lg text-black/60 dark:text-white/65">
            Let&apos;s get your creator workspace set up in three simple steps.
          </p>
        </section>
        <section className="border border-black/5 dark:border-white/10 bg-white/85 dark:bg-white/[0.06] p-8 shadow-panel">
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="border border-black/5 dark:border-white/10 bg-sand/60 dark:bg-white/[0.06] p-6 text-center"
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ocean text-sm font-semibold text-white">
                    {step.number}
                  </div>
                  <div
                    className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${step.tint}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-semibold text-ink">{step.title}</h2>
                  <p className="mt-3 text-sm text-black/60 dark:text-white/65">{step.body}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/app/intake/new"
              className="inline-flex rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white"
            >
              Upload your first documents
            </Link>
            <Link
              href="/app"
              className="inline-flex rounded-full border border-black/10 dark:border-white/12 bg-white dark:bg-white/10 dark:text-white px-6 py-3 text-sm font-semibold text-ink"
            >
              Skip and explore
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
