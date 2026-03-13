import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Mail,
  Shield,
  Sparkles,
  Zap
} from "lucide-react";

import { MarketingNav } from "@/components/marketing-nav";

const features = [
  {
    title: "Plain-English summaries",
    body: "Upload any sponsorship contract and get the terms, deadlines, and creator obligations translated into language you can actually use.",
    icon: FileText,
    tint: "bg-white/10 text-clay"
  },
  {
    title: "Risk flags",
    body: "Catch perpetual licensing, broad exclusivity, paid usage rights, and vague deliverables before you sign.",
    icon: AlertTriangle,
    tint: "bg-white/10 text-clay"
  },
  {
    title: "Negotiation emails",
    body: "Generate polished replies that help you ask for better rates, faster payment, or narrower usage rights without sounding stiff.",
    icon: Mail,
    tint: "bg-white/10 text-sage"
  },
  {
    title: "Deliverables tracker",
    body: "Keep one workspace per brand deal with deadlines, posting commitments, and approval milestones in one place.",
    icon: CheckCircle2,
    tint: "bg-white/10 text-sage"
  }
];

const lowerFeatures = [
  ...features,
  {
    title: "Usage-rights inspector",
    body: "See exactly how long a brand can use your content, where it can run, and whether ad usage deserves extra money.",
    icon: Shield,
    tint: "bg-ocean/10 text-ocean"
  },
  {
    title: "Creator-first reminders",
    body: "Draft payment follow-ups and keep late invoices from slipping through the cracks.",
    icon: Zap,
    tint: "bg-clay/10 text-clay"
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f4f2] dark:bg-transparent">
      <MarketingNav />

      <section className="relative overflow-hidden px-6 pb-24 pt-14 lg:pt-20">
        <div className="absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_left,rgba(255,122,89,0.10),transparent_22%),radial-gradient(circle_at_right,rgba(26,77,62,0.08),transparent_25%),linear-gradient(90deg,rgba(244,231,225,0.58),rgba(245,244,242,0.98)_35%,rgba(239,242,241,0.9))] dark:bg-[radial-gradient(circle_at_left,rgba(255,143,110,0.12),transparent_18%),radial-gradient(circle_at_right,rgba(127,188,165,0.12),transparent_22%),linear-gradient(90deg,rgba(18,21,24,0.9),rgba(18,21,24,0.98)_38%,rgba(23,28,31,0.92))]" />
        <div className="relative mx-auto grid max-w-[1280px] gap-16 lg:grid-cols-[0.95fr_0.9fr] lg:items-center">
          <div className="max-w-[690px] pt-14 lg:pt-20">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-[#f5e6df] px-5 py-3 text-[15px] text-clay dark:bg-white/8 dark:text-[#ff9b7f]">
              <Sparkles className="h-4 w-4" />
              Understand your brand deals before you sign
            </div>
            <h1 className="editorial-display max-w-[640px] text-[64px] font-semibold leading-[0.98] text-[#2d2d2d] dark:text-[#f2ede6] lg:text-[74px]">
              Contract clarity built for creators.
            </h1>
            <p className="mt-8 max-w-[740px] text-[20px] leading-[1.6] text-[#5f5a56] dark:text-white/68">
              HelloBrand helps influencers and solo creators turn confusing
              sponsorship contracts into plain-English summaries, watchouts, and
              negotiation-ready email drafts.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/app/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-ocean px-7 py-4 text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(26,77,62,0.18)]"
              >
                Explore the app
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex rounded-full border border-black/10 dark:border-white/12 bg-[#f2f1ef] px-7 py-4 text-[15px] font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:bg-white/8 dark:text-white dark:shadow-none"
              >
                View pricing
              </Link>
            </div>
            <p className="mt-6 text-[15px] text-[#86817c] dark:text-white/45">
              This is not legal advice. HelloBrand is not a law firm.
            </p>
          </div>

          <div className="relative lg:justify-self-end">
            <div className="absolute inset-0 translate-y-6 rounded-[36px] bg-[radial-gradient(circle_at_80%_88%,rgba(255,122,89,0.50),transparent_30%),radial-gradient(circle_at_12%_85%,rgba(46,191,111,0.20),transparent_30%)] blur-3xl" />
            <div className="relative grid min-h-[616px] max-w-[694px] gap-x-12 gap-y-16 rounded-[36px] bg-[linear-gradient(160deg,#16503f_0%,#15553f_42%,#184f3e_72%,#275447_100%)] px-[62px] py-[60px] shadow-[0_30px_80px_rgba(26,77,62,0.20)] md:grid-cols-2">
              <div className="pointer-events-none absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_86%_92%,rgba(255,122,89,0.86),transparent_28%),radial-gradient(circle_at_14%_80%,rgba(83,208,128,0.18),transparent_24%),radial-gradient(circle_at_65%_78%,rgba(255,255,255,0.08),transparent_18%)]" />
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="relative z-10"
                  >
                    <div
                      className={`mb-7 flex h-[54px] w-[54px] items-center justify-center rounded-[18px] ${feature.tint}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <h2 className="editorial-display text-[23px] font-semibold leading-[1.2] text-[#183028] dark:text-[#f2ede6]">
                      {feature.title}
                    </h2>
                    <p className="mt-4 max-w-[250px] text-[16px] leading-[1.6] text-[#183028]/88 dark:text-white/74">
                      {feature.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-black/5 dark:border-white/10 bg-[#f5f4f2] px-6 py-20 dark:bg-transparent lg:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 max-w-[760px]">
            <h2 className="editorial-display text-[58px] font-semibold leading-[1.02] text-[#2d2d2d] dark:text-[#f2ede6]">
              Everything you need to review brand deals with confidence
            </h2>
            <p className="mt-6 max-w-[900px] text-[20px] leading-[1.65] text-[#5f5a56] dark:text-white/68">
              The workflow is simple: upload the contract, review the summary,
              check the watchouts, and send a better email back to the brand.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {lowerFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="rounded-[28px] border border-black/5 dark:border-white/10 bg-white/78 dark:bg-white/[0.05] p-7 shadow-[0_18px_50px_rgba(41,39,34,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
                >
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${feature.tint}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="editorial-display text-[32px] font-semibold leading-[1.1] text-[#2d2d2d] dark:text-[#f2ede6]">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-[16px] leading-[1.7] text-[#5f5a56] dark:text-white/68">
                    {feature.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
