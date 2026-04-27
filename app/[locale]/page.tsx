import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  Hand,
  Inbox,
  type LucideIcon,
  Mail,
  Receipt,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";

import { MaintenancePage } from "@/components/maintenance-page";
import { MarketingNav } from "@/components/marketing-nav";
import { PublicFunnelLink } from "@/components/public-funnel-link";
import { HeroTabRail } from "@/components/hero-tab-rail";
import { RuntimeStatusPage } from "@/components/runtime-status-page";
import { getAppSettings } from "@/lib/admin-settings";
import { maintenanceMode } from "@/flags";
import { absoluteUrl, siteConfig } from "@/lib/site";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: absoluteUrl("/"),
  description: siteConfig.description,
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: siteConfig.description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const DocumentScanShowcase = dynamic(() =>
  import("@/components/document-scan-showcase").then((m) => m.DocumentScanShowcase)
);

const homepageTitle = "Brand Deal Contract Review for Creators | HelloBrand";
const homepageDescription = siteConfig.description;

export function generateMetadata(): Metadata {
  return {
    title: homepageTitle,
    description: homepageDescription,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: homepageTitle,
      description: homepageDescription,
      url: absoluteUrl("/"),
      siteName: siteConfig.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: homepageTitle,
      description: homepageDescription,
    },
  };
}

async function isMaintenanceModeEnabled() {
  return (await maintenanceMode()) === true;
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("homepage");
  let session: { userId: string | null } = { userId: null };
  try {
    [session] = await Promise.all([auth()]);
  } catch {
    // Clerk middleware unavailable (e.g. missing key during local dev)
  }
  const appSettings = await getAppSettings();

  if (session.userId) {
    redirect("/app");
  }

  if (await isMaintenanceModeEnabled()) {
    return <MaintenancePage />;
  }

  if (!appSettings.publicSiteEnabled) {
    return (
      <RuntimeStatusPage
        eyebrow="Public access paused"
        title="The public site is temporarily offline."
        description="A HelloBrand admin has paused public access for now. Try again later or ask the team to re-enable the site from the admin board."
        actionHref="/login"
        actionLabel="Go to login"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fefcfa] text-foreground dark:bg-[#0f1115]">
      <MarketingNav showWaitlist={false} />

      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,196,140,0.25),transparent),radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(129,178,154,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,196,140,0.10),transparent),radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(129,178,154,0.08),transparent)]" />

          <div className="relative mx-auto max-w-[1200px] px-5 pb-16 pt-12 text-center sm:px-6 md:pb-20 md:pt-16 lg:px-8 lg:pb-28 lg:pt-24">
            <h1 className="mx-auto mt-5 max-w-[14ch] text-balance text-[2.4rem] font-bold leading-[0.95] tracking-[-0.05em] text-[#1a2634] sm:mt-6 sm:text-[3.2rem] md:text-[4rem] lg:text-[4.8rem] dark:text-[#eef2f5]">
              {t("hero.headline")}
            </h1>

            <p className="mx-auto mt-5 max-w-[50ch] text-[1rem] leading-relaxed text-[#5d6876] sm:mt-6 sm:text-[1.1rem] dark:text-[#aab3bf]">
              {t("hero.subheadline")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
              <PublicFunnelLink
                href="/upload"
                eventName="landing_upload_cta_clicked"
                className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-7 text-[15px] font-semibold text-white shadow-md transition hover:bg-primary/92 hover:shadow-lg"
              >
                {t("hero.cta_upload")}
                <ArrowRight className="h-4 w-4" />
              </PublicFunnelLink>
              <PublicFunnelLink
                href="/sample"
                eventName="landing_sample_cta_clicked"
                className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-7 text-[15px] font-semibold text-foreground shadow-sm transition hover:bg-secondary dark:border-white/12 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              >
                {t("hero.cta_sample")}
              </PublicFunnelLink>
            </div>

            <p className="mt-4 text-[13px] text-[#9ba5b0] sm:text-sm dark:text-[#78828e]">
              {t("hero.trust_line")}
            </p>

            <div className="relative mx-auto mt-10 max-w-[1080px] sm:mt-14">
              <div className="max-h-[320px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)] sm:max-h-[400px] md:max-h-[480px]">
                <HeroDashboard />
              </div>
            </div>
          </div>
        </section>

        <DocumentScanShowcase />

        <section className="bg-white dark:bg-[#101318]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-[620px] text-center">
              <Eyebrow>{t("features.eyebrow")}</Eyebrow>
              <h2 className="mt-4 text-balance text-[1.8rem] font-bold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[2.4rem] md:text-[3rem]">
                {t("features.headline")}
              </h2>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                {t("features.body")}
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 md:mt-14 lg:grid-cols-3">
              {[
                {
                  icon: FileText,
                  title: t("features.summary_title"),
                  body: t("features.summary_body"),
                },
                {
                  icon: AlertTriangle,
                  title: t("features.risks_title"),
                  body: t("features.risks_body"),
                },
                {
                  icon: Receipt,
                  title: t("features.payment_title"),
                  body: t("features.payment_body"),
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.title}
                    className="group app-surface p-6 transition hover:-translate-y-0.5"
                  >
                    <div className="flex h-12 w-12 items-center justify-center bg-primary/[0.08] dark:bg-primary/[0.12]">
                      <Icon className="h-5 w-5 text-primary dark:text-[#8ec6b1]" />
                    </div>
                    <h3 className="mt-5 text-[1.2rem] font-semibold tracking-[-0.03em] text-foreground">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-[0.94rem] leading-relaxed text-muted-foreground">
                      {card.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#faf8f5] dark:bg-[#0e1014]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-28">
            <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-[1fr_1.15fr]">
              <div>
                <Eyebrow>{t("sample.eyebrow")}</Eyebrow>
                <h2 className="mt-4 text-balance text-[1.8rem] font-bold leading-[1] tracking-[-0.045em] text-foreground sm:text-[2.2rem]">
                  {t("sample.headline")}
                </h2>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                  {t("sample.body")}
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    t("sample.bullets.summary"),
                    t("sample.bullets.risks"),
                    t("sample.bullets.payment"),
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[0.94rem] text-muted-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-[#8ec6b1]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  <PublicFunnelLink
                    href="/sample"
                    eventName="landing_sample_cta_clicked"
                    payload={{ location: "sample_section" }}
                    className="inline-flex h-11 items-center justify-center gap-2 bg-primary px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/92"
                  >
                    {t("sample.cta")}
                    <ArrowRight className="h-4 w-4" />
                  </PublicFunnelLink>
                </div>
              </div>
              <PartnershipsPreview />
            </div>

            <div className="mt-16 grid items-center gap-8 md:mt-24 md:gap-12 lg:grid-cols-[1.15fr_1fr]">
              <div className="order-2 lg:order-1">
                <InboxPreview />
              </div>
              <div className="order-1 lg:order-2">
                <Eyebrow>{t("save.eyebrow")}</Eyebrow>
                <h2 className="mt-4 text-balance text-[1.8rem] font-bold leading-[1] tracking-[-0.045em] text-foreground sm:text-[2.2rem]">
                  {t("save.headline")}
                </h2>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                  {t("save.body")}
                </p>
                <ul className="mt-5 space-y-3">
                  {[t("save.bullets.email"), t("save.bullets.store"), t("save.bullets.return")].map(
                    (item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-[0.94rem] text-muted-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-[#8ec6b1]" />
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-16 grid items-center gap-8 md:mt-24 md:gap-12 lg:grid-cols-[1fr_1.15fr]">
              <div>
                <Eyebrow>{t("track.eyebrow")}</Eyebrow>
                <h2 className="mt-4 text-[1.8rem] font-bold leading-[1] tracking-[-0.045em] text-foreground sm:text-[2.2rem]">
                  {t("track.headline")}
                </h2>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                  {t("track.body")}
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    t("track.bullets.dates"),
                    t("track.bullets.status"),
                    t("track.bullets.organized"),
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[0.94rem] text-muted-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-[#8ec6b1]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <PaymentsPreview />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-[#101318]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-[620px] text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="mt-4 text-[1.8rem] font-bold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[2.4rem] md:text-[3rem]">
                {t("howItWorks.headline")}
              </h2>
            </div>

            <div className="mt-10 grid gap-4 sm:gap-5 md:mt-14 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: t("howItWorks.steps.step1_title"),
                  body: t("howItWorks.steps.step1_body"),
                },
                {
                  step: "02",
                  title: t("howItWorks.steps.step2_title"),
                  body: t("howItWorks.steps.step2_body"),
                },
                {
                  step: "03",
                  title: t("howItWorks.steps.step3_title"),
                  body: t("howItWorks.steps.step3_body"),
                },
              ].map((item) => (
                <article key={item.step} className="app-surface p-6">
                  <span className="text-[3rem] font-bold leading-none tracking-[-0.06em] text-primary/20 dark:text-[#8ec6b1]/20">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-[1.2rem] font-semibold tracking-[-0.03em] text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[0.94rem] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary dark:bg-[#1a3d30]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 text-center sm:px-6 md:py-20 lg:px-8 lg:py-24">
            <p className="mx-auto mb-8 inline-block rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white/90 sm:mb-10">
              {t("finalCta.badge")}
            </p>
            <h2 className="mx-auto max-w-[18ch] text-[1.8rem] font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-[2.4rem] md:text-[3rem]">
              {t("finalCta.headline")}
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-[0.95rem] leading-relaxed text-white/75 sm:mt-5 sm:text-[1.05rem]">
              {t("finalCta.body")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
              <PublicFunnelLink
                href="/upload"
                eventName="landing_upload_cta_clicked"
                payload={{ location: "final_cta" }}
                className="inline-flex h-12 items-center justify-center gap-2 bg-white px-7 text-[15px] font-semibold text-primary shadow-md transition hover:bg-white/92"
              >
                {t("finalCta.cta_upload")}
                <ArrowRight className="h-4 w-4" />
              </PublicFunnelLink>
              <PublicFunnelLink
                href="/sample"
                eventName="landing_sample_cta_clicked"
                payload={{ location: "final_cta" }}
                className="inline-flex h-12 items-center justify-center border border-white/20 bg-white/[0.08] px-7 text-[15px] font-semibold text-white transition hover:bg-white/[0.14]"
              >
                {t("finalCta.cta_sample")}
              </PublicFunnelLink>
            </div>
          </div>
        </section>

        <footer className="border-t border-black/[0.04] bg-white dark:border-white/[0.06] dark:bg-[#101318]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8 sm:text-sm lg:px-8">
            <p>{t("footer.copyright")}</p>
            <p>{t("footer.disclaimer")}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[12px] font-semibold uppercase tracking-[0.25em] text-primary/70 dark:text-[#8ec6b1]/80 ${className}`}
    >
      {children}
    </p>
  );
}

function PreviewChrome({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`app-surface overflow-hidden ${className}`}>
      <div className="flex items-center border-b border-black/[0.06] bg-[#fbfbfa] px-4 py-2.5 dark:border-white/[0.08] dark:bg-[#141920]">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-black/[0.08] dark:bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/[0.08] dark:bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/[0.08] dark:bg-white/[0.12]" />
          </span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </span>
        </div>
      </div>
      <div className="workspace-dot-grid p-3 sm:p-4 md:p-5">{children}</div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex h-9 items-center gap-3 px-3 text-[13px] font-medium ${
        active ? "bg-secondary/55 text-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary dark:text-[#8ec6b1]" : ""}`} />
      <span>{label}</span>
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="app-surface overflow-hidden shadow-[0_32px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
      <div className="grid lg:grid-cols-[210px_1fr]">
        <aside className="hidden border-r border-black/[0.06] bg-white lg:block dark:border-white/[0.08] dark:bg-[#121419]">
          <div className="flex h-14 items-center border-b border-black/[0.06] px-5 dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center bg-primary text-white">
                <Hand className="h-4 w-4 rotate-[18deg]" strokeWidth={2.1} />
              </div>
              <span className="text-[1.1rem] font-bold tracking-[-0.04em] text-foreground">
                HelloBrand
              </span>
            </div>
          </div>

          <div className="border-b border-black/[0.06] px-4 py-3.5 dark:border-white/[0.08]">
            <div className="flex h-8 items-center gap-2.5 border border-black/[0.06] bg-secondary/30 px-2.5 text-[12px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.03]">
              <Search className="h-3.5 w-3.5" />
              <span>Search partnerships</span>
            </div>
          </div>

          <div className="px-2.5 py-4">
            <p className="mb-2.5 px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </p>
            <div className="space-y-0.5">
              <SidebarItem icon={Sparkles} label="Dashboard" active />
              <SidebarItem icon={FileText} label="All partnerships" />
              <SidebarItem icon={Inbox} label="Inbox" />
              <SidebarItem icon={Receipt} label="Payments" />
            </div>

            <p className="mb-2.5 mt-6 px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Preferences
            </p>
            <div className="space-y-0.5">
              <SidebarItem icon={Mail} label="Notifications" />
              <SidebarItem icon={Shield} label="Settings" />
            </div>
          </div>

          <div className="border-t border-black/[0.06] px-4 py-3.5 dark:border-white/[0.08]">
            <div className="flex h-9 items-center justify-between bg-primary px-3 text-[12px] font-semibold text-white">
              <span>Save deal</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex h-14 items-center border-b border-black/[0.06] bg-white px-5 dark:border-white/[0.08] dark:bg-[#121419]">
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span>Upload</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">Contract breakdown</span>
            </div>
          </div>

          <div className="workspace-dot-grid p-4 md:p-5">
            <div className="app-surface p-5">
              <p className="text-[13px] text-muted-foreground">Anonymous preview</p>
              <h2 className="mt-2 text-[1.5rem] font-bold tracking-[-0.05em] text-foreground sm:text-[2rem] lg:text-[2.5rem]">
                Northline creator agreement
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">
                {[
                  ["Deliverables", "5 items", "3 TikToks, 2 Stories"],
                  ["Payment", "$2,500", "Net 60 after final post"],
                  ["Risk flags", "2", "Usage rights and payment timing"],
                  ["Status", "Needs review", "Before creator signs"],
                ].map(([label, value, note]) => (
                  <div
                    key={label}
                    className="border border-black/[0.06] bg-[#fcfbf9] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                  >
                    <p className="text-[11px] text-muted-foreground sm:text-[12px]">{label}</p>
                    <p className="mt-2 text-[1.2rem] font-bold tracking-[-0.04em] text-foreground sm:mt-3 sm:text-[1.6rem]">
                      {value}
                    </p>
                    <p className="mt-1 hidden text-[12px] text-muted-foreground sm:block">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <HeroTabRail items={["Summary", "Risks", "Deliverables", "Payment"]} />

            <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="app-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Watchouts
                    </p>
                    <h3 className="mt-1.5 text-[1.3rem] font-semibold tracking-[-0.04em] text-foreground">
                      Clauses worth reviewing
                    </h3>
                  </div>
                  <span className="flex items-center gap-1.5 border border-accent/20 bg-accent/[0.06] px-2.5 py-1 text-[11px] font-medium text-accent dark:border-accent/30 dark:bg-accent/[0.1]">
                    <AlertTriangle className="h-3 w-3" />2 flagged
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      title: "Perpetual usage rights",
                      note: "Brand can reuse the creator content forever unless the clause gets narrowed.",
                    },
                    {
                      title: "Payment has no late-fee leverage",
                      note: "Contract says net 60 but does not define a penalty or escalation if payment is late.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="border border-black/[0.06] bg-[#fcfbf9] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                    >
                      <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="app-surface p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Summary
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {[
                      ["3 TikTok posts", "Draft and publish by March 30"],
                      ["2 Instagram stories", "Tag brand and include campaign link"],
                      [
                        "Final payment after approval",
                        "Paid within 60 days of final accepted post",
                      ],
                    ].map(([title, body]) => (
                      <div
                        key={title}
                        className="border border-black/[0.06] bg-[#fcfbf9] px-3.5 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                      >
                        <p className="text-[13px] font-medium text-foreground">{title}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="app-surface p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Next step
                    </p>
                    <span className="text-[12px] text-muted-foreground">Save to track</span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      ["Keep this deal", "Turn the breakdown into a saved workspace"],
                      ["Track deliverables", "Use the contract terms as a checklist"],
                      ["Follow up on payment", "Come back when payout timing matters"],
                    ].map(([title, status]) => (
                      <div
                        key={title}
                        className="flex items-center justify-between gap-3 border border-black/[0.06] bg-[#fcfbf9] px-3.5 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {title}
                          </p>
                          <p className="text-[12px] text-muted-foreground">{status}</p>
                        </div>
                        <span className="text-[13px] font-semibold text-foreground">Ready</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PartnershipsPreview() {
  return (
    <PreviewChrome title="Sample contract">
      <div className="app-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Example breakdown
            </p>
            <h3 className="mt-1.5 text-[1.4rem] font-bold tracking-[-0.04em] text-foreground sm:text-[1.6rem]">
              Brand deal, translated
            </h3>
          </div>
          <span className="inline-flex h-9 items-center bg-primary px-4 text-[13px] font-semibold text-white">
            Plain English
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-4">
          {[
            ["Summary", "5 items", "3 TikToks + 2 Stories"],
            ["Payment", "$2.5K", "Net 60 after approval"],
            ["Deadline", "Mar 30", "Final post due"],
            ["Risks", "2 flags", "Usage + payment terms"],
          ].map(([label, value, note]) => (
            <div
              key={label}
              className="flex min-h-[108px] flex-col justify-between border border-black/[0.06] bg-[#fcfbf9] p-3 dark:border-white/[0.08] dark:bg-white/[0.02]"
            >
              <p className="text-[11px] text-muted-foreground sm:text-[12px]">{label}</p>
              <p className="mt-2 text-[1.05rem] font-bold tracking-[-0.04em] text-foreground sm:mt-3 sm:text-[1.25rem]">
                {value}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:mt-5">
          <div className="border border-black/[0.06] bg-white p-4 dark:border-white/[0.08] dark:bg-[#13181d]">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Summary</p>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground">
              You are required to post 3 TikToks and 2 Instagram stories by March 30.
            </p>
          </div>
          <div className="border border-black/[0.06] bg-white p-4 dark:border-white/[0.08] dark:bg-[#13181d]">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Risks</p>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground">
              Brand has perpetual usage rights and the contract does not add clear leverage for late
              payment.
            </p>
          </div>
        </div>
      </div>
    </PreviewChrome>
  );
}

function InboxPreview() {
  return (
    <PreviewChrome title="Saved workspace">
      <div className="app-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Linked inbox
            </p>
            <h3 className="mt-1.5 text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.3rem]">
              Partnership threads
            </h3>
          </div>
          <span className="border border-black/[0.06] bg-[#fcfbf9] px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.02]">
            12 new
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {[
            {
              title: "Northline campaign follow-up",
              note: "Linked to spring creator launch",
              time: "5m ago",
              active: true,
            },
            {
              title: "Studio Meridian revision",
              note: "Possible match for weekly edit",
              time: "22m ago",
              active: false,
            },
            {
              title: "Cedar Goods invoice question",
              note: "Linked to home refresh reel",
              time: "1h ago",
              active: false,
            },
          ].map((thread) => (
            <div
              key={thread.title}
              className={`border px-3.5 py-2.5 ${
                thread.active
                  ? "border-primary/15 bg-primary/[0.04] dark:border-[#8ec6b1]/20 dark:bg-[#8ec6b1]/[0.06]"
                  : "border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{thread.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{thread.note}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{thread.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PreviewChrome>
  );
}

function PaymentsPreview() {
  return (
    <PreviewChrome title="Payments">
      <div className="app-surface p-4 sm:p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Payments</p>
        <h3 className="mt-1.5 text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.3rem]">
          Payout status
        </h3>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            ["Tracked", "$18,400"],
            ["Outstanding", "$2,150"],
            ["Late", "$0"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-black/[0.06] bg-[#fcfbf9] p-3 dark:border-white/[0.08] dark:bg-white/[0.02]"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">
                {label}
              </p>
              <p className="mt-2 text-[1.1rem] font-bold tracking-[-0.04em] text-foreground sm:mt-3 sm:text-[1.4rem]">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[380px] overflow-x-auto border border-black/[0.06] dark:border-white/[0.08]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f9f8f6] px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:bg-white/[0.02]">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Brand
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Due
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Northline", "$4,800", "Mar 28", "Invoiced"],
                  ["Studio Meridian", "$3,250", "Apr 12", "Not invoiced"],
                  ["Cedar Goods", "$2,900", "Paid", "Complete"],
                ].map(([brand, amount, due, status]) => (
                  <tr
                    key={brand}
                    className="border-t border-black/[0.06] bg-white text-[13px] dark:border-white/[0.08] dark:bg-[#13181d]"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{brand}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{amount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{due}</td>
                    <td className="px-4 py-3 text-muted-foreground">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PreviewChrome>
  );
}
