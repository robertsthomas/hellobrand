import { getTranslations, setRequestLocale } from "next-intl/server";

import { MarketingNav } from "@/components/marketing-nav";
import { PricingBillingToggle } from "@/components/pricing-billing-toggle";
import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { buildMarketingPlanAvailability } from "@/lib/billing/plans";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [plans, appSettings, t] = await Promise.all([
    buildMarketingPlanAvailability(),
    getAppSettings(),
    getTranslations("pricing"),
  ]);

  if (!appSettings.publicSiteEnabled) {
    return (
      <RuntimeStatusPage
        eyebrow="Pricing paused"
        title="Pricing is hidden while the public site is paused."
        description="An admin has switched off public access, so marketing and pricing pages are currently unavailable."
        actionHref="/login"
        actionLabel="Go to login"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fefcfa] text-foreground dark:bg-[#0f1115]">
      <MarketingNav />

      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-semibold text-[#1a2634] dark:text-[#eef2f5]">
              {t("headline")}
            </h1>
            <p className="mt-5 text-lg text-black/60 dark:text-white/65">{t("subheadline")}</p>
          </div>

          <PricingBillingToggle plans={plans} />

          <p className="mt-8 text-center text-sm text-black/50 dark:text-white/40">
            {t("trust_line")}
          </p>
        </div>
      </section>

      <section className="border-t border-black/5 px-5 py-16 sm:px-8 lg:px-10 dark:border-white/5">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-[#1a2634] dark:text-[#eef2f5]">
            {t("social_proof_headline")}
          </h2>
          <p className="mt-3 text-center text-sm text-black/50 dark:text-white/40">
            {t("social_proof_body")}
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <blockquote className="rounded-2xl border border-black/5 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-sm leading-relaxed text-[#1a2634] dark:text-[#eef2f5]">
                &ldquo;{t("testimonials.jamie_quote")}&rdquo;
              </p>
              <footer className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean/10 text-sm font-semibold text-ocean dark:bg-ocean/20">
                  JT
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a2634] dark:text-[#eef2f5]">
                    {t("testimonials.jamie_name")}
                  </p>
                  <p className="text-xs text-black/40 dark:text-white/40">
                    {t("testimonials.jamie_role")}
                  </p>
                </div>
              </footer>
            </blockquote>
            <blockquote className="rounded-2xl border border-black/5 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-sm leading-relaxed text-[#1a2634] dark:text-[#eef2f5]">
                &ldquo;{t("testimonials.alex_quote")}&rdquo;
              </p>
              <footer className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean/10 text-sm font-semibold text-ocean dark:bg-ocean/20">
                  AR
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a2634] dark:text-[#eef2f5]">
                    {t("testimonials.alex_name")}
                  </p>
                  <p className="text-xs text-black/40 dark:text-white/40">
                    {t("testimonials.alex_role")}
                  </p>
                </div>
              </footer>
            </blockquote>
            <blockquote className="rounded-2xl border border-black/5 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-sm leading-relaxed text-[#1a2634] dark:text-[#eef2f5]">
                &ldquo;{t("testimonials.morgan_quote")}&rdquo;
              </p>
              <footer className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean/10 text-sm font-semibold text-ocean dark:bg-ocean/20">
                  MK
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a2634] dark:text-[#eef2f5]">
                    {t("testimonials.morgan_name")}
                  </p>
                  <p className="text-xs text-black/40 dark:text-white/40">
                    {t("testimonials.morgan_role")}
                  </p>
                </div>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="border-t border-black/5 px-5 py-12 sm:px-8 lg:px-10 dark:border-white/5">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-black/40 dark:text-white/30">
            <span>{t("footer.free")}</span>
            <span className="hidden sm:inline" aria-hidden="true">
              &middot;
            </span>
            <span>{t("footer.trials")}</span>
            <span className="hidden sm:inline" aria-hidden="true">
              &middot;
            </span>
            <span>{t("footer.cancel")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
