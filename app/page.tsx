import { auth } from "@clerk/nextjs/server";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  Hand,
  Inbox,
  type LucideIcon,
  Receipt,
  Search,
  Shield,
  Sparkles,
  Mail
} from "lucide-react";

import { MaintenancePage } from "@/components/maintenance-page";
import { MarketingNav } from "@/components/marketing-nav";

function isMaintenanceModeEnabled() {
  return process.env.MAINTENANCE_MODE?.trim().toLowerCase() === "true";
}

export default async function LandingPage() {
  const session = await auth();

  if (session.userId) {
    redirect("/app");
  }

  if (isMaintenanceModeEnabled()) {
    return <MaintenancePage />;
  }

  return (
    <div className="min-h-screen bg-[#fefcfa] text-foreground dark:bg-[#0f1115]">
      <MarketingNav />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,196,140,0.25),transparent),radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(129,178,154,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,196,140,0.10),transparent),radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(129,178,154,0.08),transparent)]" />

          <div className="relative mx-auto max-w-[1200px] px-5 pb-16 pt-12 text-center sm:px-6 md:pb-20 md:pt-16 lg:px-8 lg:pb-28 lg:pt-24">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/70 sm:text-[12px] dark:text-[#8ec6b1]/80">
              Creator partnership workspace
            </p>

            <h1 className="mx-auto mt-5 max-w-[16ch] text-[2.4rem] font-bold leading-[0.95] tracking-[-0.05em] text-[#1a2634] sm:mt-6 sm:text-[3.2rem] md:text-[4rem] lg:text-[4.8rem] dark:text-[#eef2f5]">
              Your partnerships, all in one sunny place.
            </h1>

            <p className="mx-auto mt-5 max-w-[48ch] text-[1rem] leading-relaxed text-[#5d6876] sm:mt-6 sm:text-[1.1rem] dark:text-[#aab3bf]">
              Review contracts, manage brand email threads, track payments, and
              stay on top of every deliverable — without the spreadsheet chaos.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 bg-primary px-7 text-[15px] font-semibold text-white shadow-md transition hover:bg-primary/92 hover:shadow-lg"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="inline-flex h-12 items-center justify-center border border-black/8 bg-white px-7 text-[15px] font-semibold text-foreground shadow-sm transition hover:bg-secondary dark:border-white/12 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              >
                See how it works
              </Link>
            </div>

            <p className="mt-4 text-[13px] text-[#9ba5b0] sm:text-sm dark:text-[#78828e]">
              Free during early access. No credit card required.
            </p>

            {/* Hero dashboard preview — clipped with fade */}
            <div className="relative mx-auto mt-10 max-w-[1080px] sm:mt-14">
              <div className="max-h-[320px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)] sm:max-h-[400px] md:max-h-[480px]">
                <HeroDashboard />
              </div>
            </div>
          </div>
        </section>

        {/* ── Value props ── */}
        <section className="bg-white dark:bg-[#101318]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-[620px] text-center">
              <Eyebrow>Everything you need</Eyebrow>
              <h2 className="mt-4 text-[1.8rem] font-bold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[2.4rem] md:text-[3rem]">
                One workspace replaces five tabs.
              </h2>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                Contracts, inbox threads, deliverables, and payments live
                together so nothing slips through the cracks.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 md:mt-14 lg:grid-cols-3">
              {[
                {
                  icon: FileText,
                  title: "Contract review",
                  body: "Upload agreements and get plain-language summaries with risk watchouts highlighted."
                },
                {
                  icon: Inbox,
                  title: "Linked inbox",
                  body: "Brand emails, negotiation threads, and approvals stay connected to the right partnership."
                },
                {
                  icon: Receipt,
                  title: "Payment tracking",
                  body: "Invoice timing, payout status, and follow-up notes visible right beside each partnership."
                }
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

        {/* ── Feature deep-dives with context ── */}
        <section id="features" className="bg-[#faf8f5] dark:bg-[#0e1014]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-28">

            {/* Feature 1: Partnership management */}
            <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-[1fr_1.15fr]">
              <div>
                <Eyebrow>Partnership management</Eyebrow>
                <h2 className="mt-4 text-[1.8rem] font-bold leading-[1] tracking-[-0.045em] text-foreground sm:text-[2.2rem]">
                  Every brand partnership lives in one organized workspace.
                </h2>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                  No more scattered spreadsheets or lost email chains. See every
                  active partnership, its status, contract value, and risk flags
                  at a glance. Filter by brand, stage, or amount to focus on
                  what needs attention right now.
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    "Track partnership status from review to paid",
                    "Surface risk flags before you sign",
                    "Filter and search across all partnerships"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.94rem] text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-[#8ec6b1]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <PartnershipsPreview />
            </div>

            {/* Feature 2: Smart inbox */}
            <div className="mt-16 grid items-center gap-8 md:mt-24 md:gap-12 lg:grid-cols-[1.15fr_1fr]">
              <div className="order-2 lg:order-1">
                <InboxPreview />
              </div>
              <div className="order-1 lg:order-2">
                <Eyebrow>Smart inbox</Eyebrow>
                <h2 className="mt-4 text-[1.8rem] font-bold leading-[1] tracking-[-0.045em] text-foreground sm:text-[2.2rem]">
                  Brand emails stay connected to the right partnership.
                </h2>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                  HelloBrand links incoming email threads to their matching
                  workspace automatically. Negotiation context, revision notes,
                  and approval chains live alongside the contract — not buried
                  in your personal inbox.
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    "Auto-link threads to matching partnerships",
                    "Keep negotiation history in context",
                    "Never lose a follow-up between tools"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.94rem] text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-[#8ec6b1]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Feature 3: Payment tracking */}
            <div className="mt-16 grid items-center gap-8 md:mt-24 md:gap-12 lg:grid-cols-[1fr_1.15fr]">
              <div>
                <Eyebrow>Payment tracking</Eyebrow>
                <h2 className="mt-4 text-[1.8rem] font-bold leading-[1] tracking-[-0.045em] text-foreground sm:text-[2.2rem]">
                  Know exactly where your money stands.
                </h2>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                  Track invoices, outstanding balances, and payout timelines
                  right inside the partnership workspace. No separate spreadsheet, no
                  guessing when the brand will pay — just clear numbers tied to
                  real contracts.
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    "See tracked, outstanding, and late totals",
                    "Invoice status tied to each partnership",
                    "Payment reminders that write themselves"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.94rem] text-muted-foreground">
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

        {/* ── How it works ── */}
        <section className="bg-white dark:bg-[#101318]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-[620px] text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="mt-4 text-[1.8rem] font-bold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[2.4rem] md:text-[3rem]">
                Three steps to organized partnership ops.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 sm:gap-5 md:mt-14 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Drop in a contract",
                  body: "Upload a PDF, paste a brief, or forward a brand email. HelloBrand creates a workspace around it."
                },
                {
                  step: "02",
                  title: "Review the terms",
                  body: "Get plain-language summaries, risk flags, and cross-partnership conflict warnings — no legalese."
                },
                {
                  step: "03",
                  title: "Track everything after",
                  body: "Deliverables, payment timing, and follow-up threads stay in one calm dashboard view."
                }
              ].map((item) => (
                <article
                  key={item.step}
                  className="app-surface p-6"
                >
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

        {/* ── Final CTA ── */}
        <section className="bg-primary dark:bg-[#1a3d30]">
          <div className="mx-auto max-w-[1200px] px-5 py-16 text-center sm:px-6 md:py-20 lg:px-8 lg:py-24">
            <p className="mx-auto mb-8 inline-block rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white/90 sm:mb-10">
              One paid partnership can cover months of HelloBrand
            </p>
            <h2 className="mx-auto max-w-[18ch] text-[1.8rem] font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-[2.4rem] md:text-[3rem]">
              Start your next partnership in a workspace that makes sense.
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-[0.95rem] leading-relaxed text-white/75 sm:mt-5 sm:text-[1.05rem]">
              Review terms, keep every thread attached, and stay ahead of due
              dates, all from one operating layer built for creators.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 bg-white px-7 text-[15px] font-semibold text-primary shadow-md transition hover:bg-white/92"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center border border-white/20 bg-white/[0.08] px-7 text-[15px] font-semibold text-white transition hover:bg-white/[0.14]"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-black/[0.04] bg-white dark:border-white/[0.06] dark:bg-[#101318]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8 sm:text-sm lg:px-8">
            <p>&copy; 2026 HelloBrand</p>
            <p>HelloBrand is not a law firm. This is not legal advice.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ─── Shared atoms ─── */

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
  className = ""
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
  active = false
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex h-9 items-center gap-3 px-3 text-[13px] font-medium ${
        active
          ? "bg-secondary/55 text-foreground"
          : "text-muted-foreground"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${active ? "text-primary dark:text-[#8ec6b1]" : ""}`}
      />
      <span>{label}</span>
    </div>
  );
}

/* ─── Hero dashboard ─── */

function HeroDashboard() {
  return (
    <div className="app-surface overflow-hidden shadow-[0_32px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
      <div className="grid lg:grid-cols-[210px_1fr]">
        {/* Sidebar */}
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
              <span>New workspace</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="min-w-0">
          <div className="flex h-14 items-center border-b border-black/[0.06] bg-white px-5 dark:border-white/[0.08] dark:bg-[#121419]">
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span>Workspace</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">Dashboard</span>
            </div>
          </div>

          <div className="workspace-dot-grid p-4 md:p-5">
            {/* Greeting */}
            <div className="app-surface p-5">
              <p className="text-[13px] text-muted-foreground">Friday, March 21</p>
              <h2 className="mt-2 text-[1.5rem] font-bold tracking-[-0.05em] text-foreground sm:text-[2rem] lg:text-[2.5rem]">
                Good morning, Sarah
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">
                {[
                  ["Active workspaces", "4", "1 waiting on approval"],
                  ["Tracked revenue", "$18,400", "Across 6 live partnerships"],
                  ["Outstanding", "$2,150", "1 payment due this week"],
                  ["Risk alerts", "2", "Usage and timing watchouts"]
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

            {/* Tabs + content */}
            <div className="mt-4 flex flex-wrap gap-2">
              {["Overview", "Partnerships", "Deliverables", "Payments"].map((tab, i) => (
                <span
                  key={tab}
                  className={`px-3.5 py-2 text-[13px] font-medium ${
                    i === 0
                      ? "bg-foreground text-background"
                      : "border border-black/[0.06] bg-white text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.02]"
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              {/* Review queue */}
              <div className="app-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Cross-workspace watchouts
                    </p>
                    <h3 className="mt-1.5 text-[1.3rem] font-semibold tracking-[-0.04em] text-foreground">
                      Quick review queue
                    </h3>
                  </div>
                  <span className="flex items-center gap-1.5 border border-accent/20 bg-accent/[0.06] px-2.5 py-1 text-[11px] font-medium text-accent dark:border-accent/30 dark:bg-accent/[0.1]">
                    <CheckCircle2 className="h-3 w-3" />
                    2 flagged
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      title: "Usage window overlaps spring sneaker campaign",
                      note: "Paid usage extends beyond preferred six-week approval window."
                    },
                    {
                      title: "Invoice follow-up due for Studio Meridian retainer",
                      note: "Payment due date is inside the next 7-day billing cycle."
                    }
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

              {/* This week + recent */}
              <div className="space-y-4">
                <div className="app-surface p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    This week
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {[
                      ["Contract summary ready", "Creator collaboration brief"],
                      ["1 invoice due Friday", "Northline launch flight"],
                      ["2 deliverables upcoming", "Approval copy and live post"]
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
                      Recent workspaces
                    </p>
                    <span className="text-[12px] text-muted-foreground">View all</span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      ["Northline Spark launch", "Under review", "$4,800"],
                      ["Studio Meridian edit", "Awaiting approval", "$3,250"],
                      ["Coastline matcha package", "Paid", "$2,900"]
                    ].map(([title, status, amount]) => (
                      <div
                        key={title}
                        className="flex items-center justify-between gap-3 border border-black/[0.06] bg-[#fcfbf9] px-3.5 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-foreground">{title}</p>
                          <p className="text-[12px] text-muted-foreground">{status}</p>
                        </div>
                        <span className="text-[13px] font-semibold text-foreground">{amount}</span>
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

/* ─── Preview: Partnerships ─── */

function PartnershipsPreview() {
  return (
    <PreviewChrome title="Partnerships">
      <div className="app-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
            <h3 className="mt-1.5 text-[1.4rem] font-bold tracking-[-0.04em] text-foreground sm:text-[1.6rem]">
              All partnerships
            </h3>
          </div>
          <span className="inline-flex h-9 items-center bg-primary px-4 text-[13px] font-semibold text-white">
            New workspace
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-4">
          {[
            ["Total partnerships", "6"],
            ["Active", "4"],
            ["Tracked", "$18,400"],
            ["Avg size", "$3,066"]
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-black/[0.06] bg-[#fcfbf9] p-3 dark:border-white/[0.08] dark:bg-white/[0.02]"
            >
              <p className="text-[11px] text-muted-foreground sm:text-[12px]">{label}</p>
              <p className="mt-2 text-[1.1rem] font-bold tracking-[-0.04em] text-foreground sm:mt-3 sm:text-[1.4rem]">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto sm:mt-5">
          <div className="min-w-[520px] border border-black/[0.06] dark:border-white/[0.08]">
            <div className="grid grid-cols-[1.1fr_1.3fr_0.8fr_0.9fr_0.9fr] gap-3 bg-[#f9f8f6] px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:bg-white/[0.02]">
              <span>Brand</span>
              <span>Campaign</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Risks</span>
            </div>
            {[
              ["Northline", "Spring creator launch", "$4,800", "Under review", "3 flags"],
              ["Studio Meridian", "Weekly edit package", "$3,250", "Approval", "1 flag"],
              ["Cedar Goods", "Home refresh reel", "$2,900", "Paid", "0 flags"]
            ].map(([brand, campaign, amount, status, risks]) => (
              <div
                key={campaign}
                className="grid grid-cols-[1.1fr_1.3fr_0.8fr_0.9fr_0.9fr] gap-3 border-t border-black/[0.06] bg-white px-4 py-3 text-[13px] dark:border-white/[0.08] dark:bg-[#13181d]"
              >
                <span className="font-medium text-foreground">{brand}</span>
                <span className="text-muted-foreground">{campaign}</span>
                <span className="font-medium text-foreground">{amount}</span>
                <span className="text-accent dark:text-accent">{status}</span>
                <span className="text-muted-foreground">{risks}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PreviewChrome>
  );
}

/* ─── Preview: Inbox ─── */

function InboxPreview() {
  return (
    <PreviewChrome title="Inbox">
      <div className="app-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Linked inbox</p>
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
            { title: "Northline campaign follow-up", note: "Linked to spring creator launch", time: "5m ago", active: true },
            { title: "Studio Meridian revision", note: "Possible match for weekly edit", time: "22m ago", active: false },
            { title: "Cedar Goods invoice question", note: "Linked to home refresh reel", time: "1h ago", active: false }
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

/* ─── Preview: Payments ─── */

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
            ["Late", "$0"]
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
          <div className="min-w-[380px] border border-black/[0.06] dark:border-white/[0.08]">
            <div className="grid grid-cols-4 gap-3 bg-[#f9f8f6] px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:bg-white/[0.02]">
              <span>Brand</span>
              <span>Amount</span>
              <span>Due</span>
              <span>Status</span>
            </div>
            {[
              ["Northline", "$4,800", "Mar 28", "Invoiced"],
              ["Studio Meridian", "$3,250", "Apr 12", "Not invoiced"],
              ["Cedar Goods", "$2,900", "Paid", "Complete"]
            ].map(([brand, amount, due, status]) => (
              <div
                key={brand}
                className="grid grid-cols-4 gap-3 border-t border-black/[0.06] bg-white px-4 py-3 text-[13px] dark:border-white/[0.08] dark:bg-[#13181d]"
              >
                <span className="font-medium text-foreground">{brand}</span>
                <span className="font-medium text-foreground">{amount}</span>
                <span className="text-muted-foreground">{due}</span>
                <span className="text-muted-foreground">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PreviewChrome>
  );
}
